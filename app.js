'use strict';

const Homey = require('homey');
const inspector = require('inspector'); // eslint-disable-line

class NeatoApp extends Homey.App {

  onInit() {
    this.log('Neato Robotics app is starting');
    if (process.env.DEBUG) {
      // If we are in debug env start inspector and force the app debug setting to true
      inspector.open(9229, '0.0.0.0', false);
      this.homey.settings.set('debug', true);
      this.log('Neato Robotics app is in debug mode');
    } else {
      // Else force it to false so people don't accidentally keep it on for ever
      this.homey.settings.set('debug', false);
    }
  }

}

module.exports = NeatoApp;
