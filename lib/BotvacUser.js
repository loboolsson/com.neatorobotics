'use strict';

const NodeBotvacClient = require('node-botvac/lib/client');

class BotvacUsers {

  log;
  botvacClient;

  constructor(accessToken, log) {
    if (!accessToken) {
      throw new Error('You must supply a OAuth access token');
    }

    if (!log || typeof log !== 'function') {
      throw new Error('You must pass a log function to the library');
    }
    this.botvacClient = new NodeBotvacClient(accessToken, 'OAuth');
  }

  /**
   * Get robot with specified serial number.
   * If no serial is supplied it will return the first found
   * If a serial is supplied that is not present it will throw an error
   */
  async getRobot(serial) {
    const robotPromise = this.getAllRobots()
      .then(robots => {
        if (serial) {
          for (const robot of robots) {
            if (robot._serial === serial) {
              return robot;
            }
          }
          throw new Error('Cannot find robot with id');
        }
        return robots[0];
      }, error => {
        throw new Error(error);
      });
    return robotPromise;
  }

  /**
   * Get robot
   */
  async getAllRobots() {
    const self = this;
    const robotPromise = new Promise((resolve, reject) => {
      self.botvacClient.getRobots((error, robots) => {
        if (error) {
          self.log('Error getting robots', error);
          reject(error);
        } else if (!robots) {
          self.log('0 robots returned', error);
          reject(error);
        } else {
          resolve(robots);
        }
      });
    });
    return robotPromise;
  }

}

module.exports = BotvacUsers;
