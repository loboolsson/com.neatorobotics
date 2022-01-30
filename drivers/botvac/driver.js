'use strict';

const Homey = require('homey');
const BotvacUser = require('../../lib/BotvacUser');

class BotVacDriver extends Homey.Driver {

  robots = [];

  onPair(socket) {
    let username = '';
    let password = '';

    socket.on('login', (data, callback) => {
      username = data.username;
      password = data.password;
      try {
        // Check if we can get the list of devices. If not assume credentials are invalid
        this.BotvacUser = new BotvacUser(username, password, this.log);
        this.BotvacUser.getAllRobots()
          .then(robots => {
            this.robots = robots;
            callback(null, true);
          })
          .catch(err => {
            callback(err);
          });
      } catch (err) {
        console.log(err);
        callback(err);
      }
    });

    socket.on('list_devices', (data, callback) => {
      const pairingDevices = this.robots.map(robot => {
        return {
          name: robot.name,
          data: {
            id: robot._serial,
          },
          store: {
            secret: robot._secret,
          },
        };
      });
      callback(null, pairingDevices);
    });
  }

}

module.exports = BotVacDriver;
