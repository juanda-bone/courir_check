const Telegram = require("node-telegram-bot-api");
const axios = require("axios");
require("dotenv").config();

class TrackingBot {
  constructor() {
    this.apiKey = process.env.XAPIKEY;
    this.baseUrlTracking = process.env.URLTRACKING;
    this.endpoint = process.env.ENDPOINTTRACKING;
    this.tokenTele = process.env.APITELEGRAM;
    this.apiScript = process.env.APISCRIPT;

    this.bot = new Telegram(this.tokenTele, { polling: true });
    this.bot.onText(/cek,(.*),(.*)/, this.handleCheckCommand.bind(this));
  }

  async getValueSpreadesheets() {
    const result = await axios.post(this.apiScript, { aksi: "getValue" });
    return result.data;
  }

  async getCourirTracking(courier_code, tracking_number) {
    const url = `${this.baseUrlTracking}/${this.endpoint}`;
    try {
      const response = await axios.get(url, {
        params: { courier_code, tracking_number },
        headers: {
          "x-api-key": this.apiKey,
          accept: "application/json",
        },
      });
      return {
        details: response.data.data.details,
        summary: response.data.data.summary,
      };
    } catch (error) {
      console.error("Kesalahan:", error);
      throw error;
    }
  }

  async handleCheckCommand(msg, match) {
    const chatId = msg.chat.id;
    const courierCode = match[1];
    const trackingNumber = match[2];

    try {
      const result = await this.getCourirTracking(courierCode, trackingNumber);

      const translate = await this.getTransalte(result);
      console.log(translate);
      const msg = this.generateMessage(translate, 0);
      this.bot.sendMessage(chatId, msg);
    } catch (error) {
      this.bot.sendMessage(
        chatId,
        "Terjadi kesalahan saat mengecek pengiriman."
      );
    }
  }

  async getTransalte(val) {
    val.aksi = "terjemahkan";
    const response = await axios.post(this.apiScript, val);
    return response.data;
  }

  async sendTrackingMessages() {
    try {
      const results = await this.getValueSpreadesheets();
      for (const element of results.data) {
        try {
          const result = await this.getCourirTracking(element[0], element[1]);
          const length = await this.checkLengthUpdated(
            result.details,
            element[3],
            element[4]
          );
          if (!length) {
            const translate = await this.getTransalte(result);
            const msg = this.generateMessage(translate, element[3]);
            this.bot.sendMessage(element[2], msg);
          }
        } catch (error) {
          console.log(error);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  async checkLengthUpdated(updateDB, lengthInDB, id) {
    if (updateDB.length != lengthInDB) {
      this.setLengthDetailsInDB(updateDB.length, id);
      return false;
    } else {
      return true;
    }
  }

  async setLengthDetailsInDB(lengthUpdate, id) {
    try {
      const response = await axios.post(this.apiScript, {
        aksi: "updateLength",
        id,
        lengthUpdate,
      });
    } catch (err) {
      console.log(err);
    }
  }

  generateMessage(newResult, start) {
    let result = newResult.data;
    let msg = `---------------------------------\ntracking = ${
      result.summary.tracking_number
    }\ncode courir = ${result.summary.courier_code}\nstatus = ${
      result.summary.status
    }\n${this.convertTimestampToGMT8Formatted(
      result.summary.timestamp
    )}\n---------------------------------`;
    let detailReverse = result.details.reverse();
    for (let i = start; i < detailReverse.length; i++) {
      let e = detailReverse[i];

      msg += `\n${e.description}\n${
        e.location
      }\n${this.convertTimestampToGMT8Formatted(e.timestamp)}\n`;
    }

    return msg;
  }

  convertTimestampToGMT8Formatted(timestamp) {
    const date = new Date(timestamp * 1000);
    const options = {
      weekday: "long",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    };
    const formattedTime = new Intl.DateTimeFormat("id-ID", options).format(
      date
    );
    return formattedTime;
  }
}

// Instantiate the TrackingBot class and start the process
const trackingBot = new TrackingBot();
setInterval(() => {
  trackingBot.sendTrackingMessages();
}, 60000);
