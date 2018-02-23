'use strict';

const Homey = require('homey');
const NeatoApi = require('../../lib/NeatoApi');

const SEARCH_INTERVAL = 60000;

class BotVacDriver extends Homey.Driver {

  async onInit() {
    this.neatoApi = new NeatoApi();
  }

  onPair(socket) {

    let apiUrl = this.neatoApi.getOAuth2AuthorizationUrl();
    let neatoOAuthCallback = new Homey.CloudOAuth2Callback(apiUrl)

    neatoOAuthCallback
     .on('url', url => {
         // dend the URL to the front-end to open a popup
         socket.emit('url', url);
     })
     .on('code', async code => {
         // ... swap your code here for an access token
         let tokensObject = await this.neatoApi.exchangeCode(code);
         this.neatoApi.setToken(tokensObject.access_token, tokensObject.expires_in);
         this.neatoApi.setRefreshToken(tokensObject.refresh_token);
         // tell the front-end we're done
         this.emit(`authorized`);
         socket.emit('authorized');
     })
     .generate()
     .catch( err => {
         socket.emit('error', err);
     });

    socket.on('list_devices', async (data, callback) => {
      let pairingDevices = [];
      let robots = await this.neatoApi.getRobots();

      this.log('Robots found:', robots);
      for(let i = 0; i < robots.length; i++) {
        let robot = robots[i];

        pairingDevices.push({
          name: robot.name,
          data: {
            id: robot._serial,
            secret: robot._secret,
          }
        });
      }

      callback(null, pairingDevices);
    });
  }
}

module.exports = BotVacDriver;
