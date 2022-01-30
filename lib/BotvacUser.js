'use strict';

const NodeBotvacClient = require('node-botvac/lib/client');

class BotvacUsers {

  user='';
  pass='';
  log;
  botvacClient=new NodeBotvacClient();

  constructor(user, pass, log) {
    if (!user || !pass) {
      throw new Error('Must have a username/password for Botvac connection');
    }
    this.user = user;
    this.pass = pass;
    if (!log) {
      throw new Error('You must pass a log function to the library');
    }
    if (typeof log !== 'function') {
      throw new Error('Passed log must be a function');
    }
    this.log = log;
    this.log('Botvac lib initiated');
  }

  /**
   * Authentication
   */
  async auth() {
    const self = this;
    self.log('Run auth');
    const authPromise = new Promise((resolve, reject) => {
      self.log('In the promise');
      self.botvacClient.authorize(self.user, self.pass, false, error => {
        if (error) {
          self.log('Auth error', error);
          reject(error);
        } else {
          self.log('Auth success', error);
          resolve(true);
        }
      });
    });
    self.log('return auth');
    return authPromise;
  }

  /**
   * Get robot with specified serial number.
   * If no serial is supplied it will return the first found
   * If a serial is supplied that is not present it will throw an error
   */
  async getRobot(serial) {
    const self = this;

    const robotPromise = this.getAllRobots()
      .then(robots => {
        self.log(robots);
        if (serial) {
          for (const robot of robots) {
            self.log(robot);
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
    self.log('return robot');
    return robotPromise;
  }

  /**
   * Get robot
   */
  async getAllRobots() {
    const self = this;

    try {
      await this.auth();
    } catch (error) {
      return Promise.reject(error);
    }

    self.log('Getting all robots');
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
