'use strict';

const NodeBotvacClient = require('node-botvac/lib/client');

class BotvacUser {

  /**
   * Get robot
   */
  async getAllRobots(accessToken) {
    const botvacClient = new NodeBotvacClient(accessToken, 'OAuth');
    const robotPromise = new Promise((resolve, reject) => {
      botvacClient.getRobots((error, robots) => {
        if (error) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`Error getting robots: ${error}`);
        } else if (!robots) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject('0 robots returned');
        } else {
          resolve(robots);
        }
      });
    });
    return robotPromise;
  }

}

module.exports = BotvacUser;
