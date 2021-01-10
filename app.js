'use strict';

const Homey = require('homey');
const Botvac = require('node-botvac');

class BotVacCommunity extends Homey.App {
  credentials={};

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {

    //Register Actions
    let startCleaningAction = this.homey.flow.getActionCard('start_cleaning');
    startCleaningAction
        .registerRunListener(async (args, state) => {
          this.log("Has started");
          let startCleaning = this.startCleaning(this.log);
          return startCleaning;
        });

    let stopCleaningAction = this.homey.flow.getActionCard('stop_cleaning');
    stopCleaningAction.registerRunListener(async (args, state) => {
      // this.homey.speak("Stop Cleaning");
      this.log("Has stopped");
      let StopCleaning = this.stopCleaning(this.log);
      return StopCleaning;
    });

    //get user credentials
    this.credentials.user = this.homey.settings.get('username');
    this.credentials.pass = this.homey.settings.get('password');

    this.log('BotVacCommunity has been initialized');
  }

  /**
   * Start the cleaning cycle.
   */
  startCleaning (log) {
    log("startCleaning function call")
    var client = new Botvac.Client();
    //authorize
    client.authorize(this.credentials.user, this.credentials.pass, true, function (error) {
      if (error) {
        log(error);
        return Promise.resolve(false);
      }
      //get your robots
      client.getRobots(function (error, robots) {
        if (error) {
          log(error);
          return Promise.resolve(false);
        }
        if (robots.length) {
          //Start cleaning with the First Robot
          var robot = robots[0];
          robot.getState(
            function (error, state) {
              if (error) {
                log(robot.name + " got an error");
                return Promise.resolve(false);
              }

              if (!state || !state.availableCommands) {
                log(robot.name + " didn't return states");
                return Promise.resolve(false)
              }

              if (state.availableCommands.start) {
                robot.startCleaning(true, 2, true);
                log(robot.name + " will start cleaning");
                return Promise.resolve(true);
              } else if (state.availableCommands.resume) {
                robot.resumeCleaning();
                log(robot.name + " will resume cleaning");
                return Promise.resolve(true);
              } else {
                log(robot.name + " cannot start or resume");
                return Promise.resolve(false);
              }
            }
          )
        } else {
          log("No robots found");
          return Promise.resolve(false);
        }
      });
    });
  }

  /**
   * Stop (pause) the cleaning cycle and send BotVac to dock.
   */
  stopCleaning (log) {
    log("stopCleaning function call")
    var client = new Botvac.Client();
    //authorize
    client.authorize(this.credentials.user, this.credentials.pass, true, function (error) {
      if (error) {
        log(error);
        return Promise.resolve(false);
      }
      //get your robots
      client.getRobots(function (error, robots) {
        if (error) {
          log(error);
          return Promise.resolve(false);
        }
        if (robots.length) {
          //Pause cleaning with the First Robot (Cleaning must be paused before it can be sent to dock)
          robots[0].pauseCleaning(function (error, result) {
            if (error) {
              log("Error with pausing", error)
              return Promise.resolve(false);
            }
            log(robots[0].name + " was paused");

            var sendToDock = function (robot, retries, log) {
              if (retries > 0) {
                robot.getState(function (error, state) {
                  if (error) {
                    return Promise.resolve(false);
                  }
                  if (state && state.availableCommands) {
                    log(state.availableCommands);
                    if (state.availableCommands.goToBase) {
                      robot.sendToBase();
                      log(robot.name + " will return to base");
                      return Promise.resolve(true);
                    } else {
                      retries--;
                      return sendToDock(robot, retries, log);
                    }
                  }
                })
              } else {
                log(robot.name + " cannot return to base");
                return Promise.resolve(false);
              }
            }
            // It can take significant time from BotVac Pause until it can be sent to dock.
            // Resolving this with retries for now
            return sendToDock(robots[0], 50, log)
          });
        }
      });
    });
  }
}

module.exports = BotVacCommunity;