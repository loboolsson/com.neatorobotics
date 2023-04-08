'use strict';

const Homey = require('homey');
const axios = require('axios').default;
const BotvacUser = require('../../lib/BotvacUser');

class BotVacDriver extends Homey.Driver {

  robots = [];
  _clientId = Homey.env.NEATO_CLIENT_ID;
  _clientSecret = Homey.env.NEATO_SECRET;
  _scope = Homey.env.NEATO_SCOPES;
  _oAuthBaseUrl = 'https://apps.neatorobotics.com/oauth2';
  _oAuthRedirectUrl = 'https://callback.athom.com/oauth2/callback/';
  _oAuth2AuthUrl = `${this._oAuthBaseUrl}/authorize?response_type=code&client_id=${this._clientId}&scope=${this._scope}&redirect_uri=${this._oAuthRedirectUrl}`;
  _oAuth2TokenUrl = `${this._oAuthBaseUrl}/token`;

  async getOauthToken(code) {
    try {
      const response = await axios
        .post(this._oAuth2TokenUrl, {
          client_id: this._clientId,
          client_secret: this._clientSecret,
          redirect_uri: this._oAuthRedirectUrl,
          grant_type: 'authorization_code',
          code,
        });

      return response.data;
    } catch (error) {
      // Handle Error Here
      console.error(error);
      throw new Error(error);
    }
  }

  onPair(socket) {
    const neatoOAuthCallback = new Homey.CloudOAuth2Callback(this._oAuth2AuthUrl);
    neatoOAuthCallback
      .on('url', (url) => {
        socket.emit('url', url);
      })
      .on('code', async (code) => {
        const tokensObject = await this.getOauthToken(code);
        this.BotvacUser = new BotvacUser(tokensObject.access_token, this.log);
        socket.emit('authorized');
      })
      .generate()
      .catch((err) => {
        socket.emit('error', err);
      });

    socket.on('list_devices', (data, callback) => {
      try {
        // Check if we can get the list of devices. If not assume credentials are invalid
        this.BotvacUser.getAllRobots()
          .then((robots) => {
            const pairingDevices = robots.map((robot) => {
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
          })
          .catch((err) => {
            callback(err);
          });
      } catch (err) {
        console.log(err);
        callback(err);
      }
    });
  }

}

module.exports = BotVacDriver;
