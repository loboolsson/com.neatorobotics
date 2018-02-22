'use strict';

const Homey = require('homey');
// Overridden version of botvac client that's promisified, called Neato for ease of use
const Neato = require('../../lib/node-botvac-promisified');
const NeatoClient = new Neato.Client();

const SEARCH_INTERVAL = 60000;

class BotVacDriver extends Homey.Driver {

  async onInit() {
    this._robots = {};

    let username = Homey.ManagerSettings.get('username');
    let password = Homey.ManagerSettings.get('password');

    try {
      await NeatoClient.authorize(username, password, false);

      // Search for new robots every minute
      this._robotSearchInterval = setInterval(this._searchRobots.bind(this), SEARCH_INTERVAL);
      this._searchRobots();
    } catch (err) {
      this.error(err);
    }
  }

  onPair(socket) {
    socket.on('list_devices', async (data, callback) => {

      let pairingDevices = [];

      for(let robotKey in this._robots) {
        if (!this._robots.hasOwnProperty(robotKey)) continue;

        let robot = this._robots[robotKey];

        pairingDevices.push({
          name: robot.name,
          data: {
            id: robot._serial
          }
        });
      }

      callback(null, pairingDevices);
    });
  }

  getRobot(serial) {
    return this._robots[serial];
  }

  removeRobot(serial) {
    delete this._robots[serial];
  }

  async _searchRobots() {
    let robots = await NeatoClient.getRobots();

    for(let i = 0; i < robots.length; i++) {
      let robot = robots[i];
      this._robots[robot._serial] = robot;
      this.emit(`BotVac:${robot._serial}`);
    }
  }
}

module.exports = BotVacDriver;
