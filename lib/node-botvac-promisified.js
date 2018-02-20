'use strict';

const Neato = require('node-botvac');
const NeatoClient = require('node-botvac/lib/client.js');
const NeatoRobot = require('node-botvac/lib/robot.js');
const {promisify} = require('util');

// Promisify callback functions of Neato client
NeatoClient.prototype.authorize = promisify(NeatoClient.prototype.authorize);
NeatoClient.prototype.getRobots = promisify(NeatoClient.prototype.getRobots);

// Promisify callback functions of Neato robot
NeatoRobot.prototype.getState = promisify(NeatoRobot.prototype.getState);
NeatoRobot.prototype.getSchedule = promisify(NeatoRobot.prototype.getSchedule);
NeatoRobot.prototype.enableSchedule = promisify(NeatoRobot.prototype.enableSchedule);
NeatoRobot.prototype.disableSchedule = promisify(NeatoRobot.prototype.disableSchedule);
NeatoRobot.prototype.sendToBase = promisify(NeatoRobot.prototype.sendToBase);
NeatoRobot.prototype.stopCleaning = promisify(NeatoRobot.prototype.stopCleaning);
NeatoRobot.prototype.pauseCleaning = promisify(NeatoRobot.prototype.pauseCleaning);
NeatoRobot.prototype.resumeCleaning = promisify(NeatoRobot.prototype.resumeCleaning);
NeatoRobot.prototype.startSpotCleaning = promisify(NeatoRobot.prototype.startSpotCleaning);
NeatoRobot.prototype.startManualCleaning = promisify(NeatoRobot.prototype.startManualCleaning);
NeatoRobot.prototype.startCleaning = promisify(NeatoRobot.prototype.startCleaning);

module.exports = Neato;
