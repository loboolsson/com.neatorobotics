'use strict';

const Homey = require('homey');

class NeatoApp extends Homey.App {

  onInit() {
    this.log('Neato Robotics app is running');
  }

}

module.exports = NeatoApp;
