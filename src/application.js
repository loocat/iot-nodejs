var xhr = require('axios');
var format = require('format');
var btoa = btoa || require('btoa'); // if browser btoa is available use it otherwise use node module

const m2m = require('onem2m');
const util = require('util');

var isDefined = require('./util').isDefined;
var isString = require('./util').isString;
// var isNode = require('./util').isNode;

// const DEVICE_EVT_RE = /^iot-2\/type\/(.+)\/id\/(.+)\/evt\/(.+)\/fmt\/(.+)$/;
// const DEVICE_CMD_RE = /^iot-2\/type\/(.+)\/id\/(.+)\/cmd\/(.+)\/fmt\/(.+)$/;
// const DEVICE_MON_RE = /^iot-2\/type\/(.+)\/id\/(.+)\/mon$/;
// const APP_MON_RE = /^iot-2\/app\/(.+)\/mon$/;

var getPrimitiveContent = rsp => rsp.pc[Object.keys(rsp.pc)[0]];

var promise = {
  Existence: function (path) {
    return new Promise((res, rej) => {
      this.retrieve(path, (rsp) => {
        if (rsp.rsc === m2m.code.getResponseStatusCode('OK')) {
          res(getPrimitiveContent(rsp));
        } 
        else {
          let arr = path.split('/');
          let rn = arr.pop();
          this.create(arr.join('/'), {
            ty: m2m.code.getResourceType('container'),
            rn: rn
          }, (rsp) => {
            switch (rsp.rsc) {
            case m2m.code.getResponseStatusCode('OK'):
            case m2m.code.getResponseStatusCode('CREATED'):
            case m2m.code.getResponseStatusCode('ALREADY_EXISTS'):
              res(getPrimitiveContent(rsp));
              break;
            default:
              rej(rsp.rsc);
            };
          });
        }
      });
    });
  },
  Retrieve: function (path) {
    return new Promise((res, rej) => {
      this.retrieve(path, (rsp) => {
        if (rsp.rsc === m2m.code.getResponseStatusCode('OK')) {
          res(getPrimitiveContent(rsp));
        }
        else {
          rej(rsp.rsc, to);
        }
      });
    });
  },
  Discovery: function (query) {
    let to = query;
    if (typeof query === 'string') try {
      query = require('querystring').parse(query);
    }
    catch (e) {
    }
    if (typeof to === 'object') {
      to = query.to;
      delete query.to;
    }
    return new Promise((res, rej) => {
      this.discovery(to, query, (rsp) => {
        if (rsp.rsc === m2m.code.getResponseStatusCode('OK')) {
          res(getPrimitiveContent(rsp).split(' '));
        }
        else {
          rej(rsp.rsc, to);
        }
      })
    });
  },
  Execute: function (operation, response, args) {
    if (!Array.isArray(response)) response = [response];
    if (!Array.isArray(args)) args = [args];
    return new Promise((res, rej) => {
      let callback = (rsp) => {
        if (response.indexOf(rsp.rsc) > -1) {
          res(rsp.pc ? getPrimitiveContent(rsp) : rsp);
        }
        else {
          rej(rsp.rsc, rsp.pc);
        }
      };
      args.push(callback);
      operation.apply(this, args);
    });
  },
  Batch: function (type, id, box, option, operation) {
    let onError = (rsc, reason) => {
      console.error('[ERR] ' + reason + '...' + m2m.code.getResponseStatusCode(rsc));
      throw new Error(reason);
    }

    if (typeof option === 'function') {
      operation = option;
      option = undefined;
    }

    if (!box) {
      this.log.error('[App:Batch] missing argument: message box');
      throw new Error();
    }

    let path2arg = path => {
      let tmp = { path: path + '/' + box };
      if (option) {
        Object.keys(option).map(k => { if (option[k]) tmp[k] = option[k]; });
      }
      return tmp;
    };

    return new Promise((res, rej) => {
      if (!type) {
        // no device type
        promise.Discovery.call(this, { to: 'dev', ty:m2m.code.getResourceType('container'), lvl: 1 }).then((types) => {
          let args = types.map((type) => { return {to:type,ty:3,lvl:1}; });
          return Promise.all(args.map(promise.Discovery, this));
        }).then((devices) => {
          let args = devices.reduce((p, c) => p.concat(c)).map(path2arg);
          return Promise.all(args.map(operation, this));
        }).then(arr => res(arr))
        .catch(onError);
      }
      else if (!id) {
        // no device id
        promise.Discovery.call(this, {to:'dev/'+type,ty:3,lvl:1}).then((paths) => {
          let args = paths.map(path2arg);
          return Promise.all(args.map(operation, this));
        }).then(arr => res(arr))
        .catch(onError);
      }
      else {
        // both of device type and id are present
        operation.call(this, path2arg(util.format('dev/%s/%s', type, id)))
        .then(arr => res(arr))
        .catch(onError);
      }
    });
  },
  LatestDeviceMessage: function (option) {
    return new Promise((res, rej) => {
      let path = option.path;
      this.retrieve(path + '/la', (rsp) => {
        if (rsp.rsc === m2m.code.getResponseStatusCode('OK')) {
          var body = { box: path.replace(/.*\/dev\//, '') };
          if (rsp.pc) {
            let cin = getPrimitiveContent(rsp);
            body.msg = JSON.parse(cin.con);
            body.msg.time = cin.ct;
          }
          res(body);
        }
        else {
          rej(rsp.rsc, rsp.pc);
        }
      })
    })
  },
  CollectDeviceMessages: function (option) {
    return new Promise((res, rej) => {
      let path = option.path;
      let fc = {
        ty: m2m.code.getResourceType('contentInstance'),
        lbl: option.tag,
        cra: option.start,
        crb: option.end,
        lim: option.lim,
        lvl: option.lvl || 1
      };
      this.discovery(path, fc, (rsp) => {
        if (rsp.rsc === m2m.code.getResponseStatusCode('OK')) {
          let body = { box: path.replace(/.*\/dev\//, '') };
          let arr = getPrimitiveContent(rsp).split(' ');
          if (arr.length > 0) {
            Promise.all(arr.map(promise.Retrieve, this)).then((arr) => {
              if (arr.length > 0) {
                let msg = arr.map(cin => { let tmp = JSON.parse(cin.con); tmp.time = cin.ct; return tmp; });
                body.msg = (msg.length === 1) ? msg[0] : msg;
              }
              res(body);
            })
            .catch(() => res(body));
          }
          else {
            res(body);
          }
        }
        else {
          rej(rsp.rsc, rsp.pc);
        }
      });
    });
  }
}

var priv = {
  start: function (callback) {
    Promise.all(['dev', 'mon'].map(promise.Existence, this)).then((arr) => {
      console.log('containers... OK');
      return promise.Discovery.call(this, {ty: m2m.code.getResourceType('subscription')});
    }).then((uril) => {
      console.log('search subscription urls... OK');
      uril.map((path, index) => {
        if (path.indexOf(this.id) !== (path.length - this.id.length)) {
          uril.splice(index, 1);
        }
      });
      return Promise.all(uril.map(promise.Retrieve, this));
    }).then((arr) => {
      console.log('collect subscriptions... OK');
      arr.map((r) => {
        let path = r.pi;
        let lbl = r.lbl;
        let subs = this.subscriptions;
        if (!subs[path]) { subs[path] = []; }
        subs[path] = lbl ? lbl.split(' ') : '*';
      });
      console.log(Object.keys(this.subscriptions));
      if (callback) callback();
    }).catch((reason) => {
      console.error(util.format('[ERR] %s (%d)', m2m.code.getResponseStatusCode(reason), reason));
    });
  },
  batch: function (type, id, operation) {
    let onError = (rsc, reason) => {
      console.error('[ERR] ' + reason + '...' + m2m.code.getResponseStatusCode(rsc));
      throw new Error(reason);
    }

    if (!type) {
      // no device type
      promise.Discovery.call(this, {to:'dev',ty:3,lvl:1}).then((types) => {
        let args = types.map((type) => { return {to:type,ty:3,lvl:1}; });
        return Promise.all(args.map(promise.Discovery, this));
      }).then((devices) => {
        devices.reduce((p, c) => p.concat(c)).map(operation);
      }).catch(onError);
    }
    else if (!id) {
      // no device id
      promise.Discovery.call(this, {to:'dev/'+type,ty:3,lvl:1}).then((paths) => {
        paths.map(operation);
      }).catch(onError);
    }
    else {
      // both of device type and id are present
      operation(util.format('dev/%s/%s', type, id));  
    }
  },
  manageDeviceSubscription: function (op, type, id, box, tag, qos) {
    let manage = (path) => {
      op.call(this, path + '/' + box, {lbl: tag});
    }

    if (!box) {
      // message box should be present
      this.log.error('[manageDevice]', arguments);
      throw new Error('Message box not specified');
    }

    priv.batch.call(this, type, id, manage);
  },
  publishDeviceMessage: function (type, id, box, tag, msg, qos, callback) {
    let publish = (path) => {
      this.publish(path + '/' + box, msg, {lbl: tag, qos:qos}, callback);
    }

    if (!type) {
      // device type should be present
      this.log.error('[publishDeviceMessage]', arguments);
      throw new Error('[publishDeviceMessage] Device type not specified');
    }

    if (!id) {
      // device id should be present
      this.log.error('[publishDeviceMessage]', arguments);
      throw new Error('[publishDeviceMessage] Device id not specified');
    }

    if (!box) {
      // message category should be present
      this.log.error('[publishDeviceMessage]', arguments);
      throw new Error('[publishDeviceMessage] Message category not specified');
    }

    if (!msg) {
      // message should be present
      this.log.error('[publishDeviceMessage]', arguments);
      throw new Error('[publishDeviceMessage] Message body not specified');
    }

    priv.batch.call(this, type, id, publish);
  }
};

class App extends require('./base.js') {
  constructor(config) {
    super(config);

    if (!this.mqttConfig.username) {
      if (!isDefined(config['auth-key'])) {
        throw new Error('[App:constructor] config must contain auth-key');
      }
      if (!isString(config['auth-key'])) {
        throw new Error('[App:constructor] auth-key must be a string');
      }
      this.mqttConfig.username = config['auth-key'];
    }

    this.apiKey = this.mqttConfig.username;
    this.apiToken = this.mqttConfig.password;
    this.mqttConfig.clientId = util.format('a:%s:%s', this.org, this.id);
    this.subscriptions = {};

    this.log.info("[App:constructor] App initialized for organization : " + this.org);
  }

  connect(qos, callback) {
    super.connect(qos, () => {
      this.log.info("[App:connnect] App Connected");
      this.isConnected = true;

      if (this.retryCount === 0) {
        this.emit('connect');
      } else {
        this.emit('reconnect');
      }

      priv.start.call(this, callback);

      //reset the counter to 0 incase of reconnection
      this.retryCount = 0;
    });

    // this.mqtt.on('message', (topic, payload) => {
    //   this.log.trace("[App:onMessage] mqtt: ", topic, payload.toString());

    //   // For each type of registered callback, check the incoming topic against a Regexp.
    //   // If matches, forward the payload and various fields from the topic (extracted using groups in the regexp)

    //   var match = DEVICE_EVT_RE.exec(topic);
    //   if (match) {
    //     this.emit('deviceEvent',
    //       match[1],
    //       match[2],
    //       match[3],
    //       match[4],
    //       payload,
    //       topic
    //     );

    //     return;
    //   }


    //   var match = DEVICE_CMD_RE.exec(topic);
    //   if (match) {
    //     this.emit('deviceCommand',
    //       match[1],
    //       match[2],
    //       match[3],
    //       match[4],
    //       payload,
    //       topic
    //     );

    //     return;
    //   }

    //   var match = DEVICE_MON_RE.exec(topic);
    //   if (match) {
    //     this.emit('deviceStatus',
    //       match[1],
    //       match[2],
    //       payload,
    //       topic
    //     );

    //     return;
    //   }

    //   var match = APP_MON_RE.exec(topic);
    //   if (match) {
    //     this.emit('appStatus',
    //       match[1],
    //       payload,
    //       topic
    //     );
    //     return;
    //   }

    //   // catch all which logs the receipt of an unexpected message
    //   this.log.warn("[App:onMessage] Message received on unexpected topic" + ", " + topic + ", " + payload);
    // });

    return this;
  }

  subscribeToDeviceEvents(type, id, event, qos) {
    priv.manageDeviceSubscription.call(this, this.subscribe, type, id, 'evt', event, qos);
    return this;
  }

  unsubscribeToDeviceEvents(type, id, event) {
    priv.manageDeviceSubscription.call(this, this.unsubscribe, type, id, 'evt', event);
    return this;
  }

  subscribeToDeviceCommands(type, id, command, qos) {
    priv.manageDeviceSubscription.call(this, this.subscribe, type, id, 'cmd', command, qos);
    return this;
  }

  unsubscribeToDeviceCommands(type, id, command) {
    priv.manageDeviceSubscription.call(this, this.unsubscribe, type, id, 'cmd', command);
    return this;
  }

  subscribeToDeviceStatus(type, id, qos) {
    priv.manageDeviceSubscription.call(this, this.subscribe, type, id, 'mon', undefined, qos);
    return this;
  }

  subscribeToAppStatus(id, qos) {
    this.subscribe(util.format('%s/mon', id));
    return this;
  }

  unsubscribeToDeviceStatus(type, id, qos) {
    priv.manageDeviceSubscription.call(this, this.unsubscribe, type, id, 'mon', undefined);
    return this;
  }

  unsubscribeToAppStatus(id) {
    this.unsubscribe(util.format('%s/mon', id));
    return this;
  }

  //
  // publish an device event
  //
  publishDeviceEvent(type, id, event, data, qos, callback) {
    if (!this.isConnected) {
      this.log.error("[App:publishDeviceEvent] Client is not connected");
      this.emit('error', "[App:publishDeviceEvent] Client is not connected");
    }
    else {
      this.log.debug('[App:publishDeviceEvent] event ' + event + ' with data ' + data + ' with qos ' + qos);
      priv.publishDeviceMessage.call(this, type, id, 'evt', event, data, qos, callback);
    }
    return this;
  }

  //
  // publish an device command
  //
  publishDeviceCommand(type, id, command, data, qos, callback) {
    if (!this.isConnected) {
      this.log.error("[App:publishDeviceCommand] Client is not connected");
      this.emit('error', "[App:publishDeviceCommand] Client is not connected");
    }
    else {
      this.log.debug('[App:publishDeviceCommand] command ' + command + ' with data ' + data + ' with qos ' + qos);
      priv.publishDeviceMessage.call(this, type, id, 'cmd', command, data, qos, callback);
    }
    return this;
  }

  // callApi(method, expectedHttpCode, expectJsonContent, paths, body, params) {
  //   return new Promise((resolve, reject) => {
  //     let uri = format("https://%s.%s/api/v0002", this.org, this.domainName);

  //     if (Array.isArray(paths)) {
  //       for (var i = 0, l = paths.length; i < l; i++) {
  //         uri += '/' + paths[i];
  //       }
  //     }

  //     let xhrConfig = {
  //       url: uri,
  //       method: method,
  //       headers: {
  //         'Content-Type': 'application/json'
  //       }
  //     };

  //     if (this.useLtpa) {
  //       xhrConfig.withCredentials = true;
  //     }
  //     else {
  //       xhrConfig.headers['Authorization'] = 'Basic ' + btoa(this.apiKey + ':' + this.apiToken);
  //     }

  //     if (body) {
  //       xhrConfig.data = body;
  //     }

  //     if (params) {
  //       xhrConfig.params = params;
  //     }

  //     function transformResponse(response) {
  //       if (response.status === expectedHttpCode) {
  //         if (expectJsonContent && !(typeof response.data === 'object')) {
  //           try {
  //             resolve(JSON.parse(response.data));
  //           } catch (e) {
  //             reject(e);
  //           }
  //         } else {
  //           resolve(response.data);
  //         }
  //       } else {
  //         reject(new Error(method + " " + uri + ": Expected HTTP " + expectedHttpCode + " from server but got HTTP " + response.status + ". Error Body: " + data));
  //       }
  //     }
  //     this.log.debug("[App:transformResponse] " + xhrConfig);
  //     xhr(xhrConfig).then(transformResponse, reject);
  //   });
  // }

  callApi(method, code, json, paths, body, params) {
    if (typeof body === 'string') body = JSON.parse(body);

    let bulk = false;
    let path = paths || '';
    if (Array.isArray(paths)) {
      path = paths[0];
      if (path === 'device') path = 'dev';
      let idx = paths.indexOf('types');
      if (idx > -1) {
        if (idx < paths.length - 1) {
          path += '/' + paths[idx + 1];
        }
        else {
          bulk = true;
        }
      } 
      idx = paths.indexOf('devices');
      if (idx > -1) {
        if (idx < paths.length - 1) {
          path += '/' + paths[idx + 1];
        }
        else {
          bulk = true;
        }
      }
    }

    let op;
    let args = [path];
    if (method === 'GET') {
      // op = (bulk ? this.discovery : this.retrieve);
      if (bulk) {
        op = this.discovery;
        args.push({lvl: 1, ty: m2m.code.getResourceType('container')});
      }
      else {
        op = this.retrieve;
      }
    }
    else if (method === 'DELETE') {
      op = this.delete;
    }
    else if (method === 'PUT') {
      op = this.update;
      args.push(body);
    }
    else if (method === 'POST') {
      op = this.create;
      args.push({
        ty: m2m.code.getResourceType('container'),
        rn: body.id // device type or device id
      });
    }

    return new Promise((res, rej) => {
      console.log(method, bulk, args);
      args.push((rsp) => {
        // console.log('PROMISE---');
        // console.log(JSON.stringify(rsp, null, ' '));
        let rsc = m2m.code.translateResponseStatusCodeToHttpStatusCode(rsp.rsc);
        if (rsc === code) {
          res(getPrimitiveContent(rsp));
          if (bulk && op === this.create) {
            var tmp = ['evt', 'cmd', 'mon'].map(con => path + '/' + body.id + '/' + con);
            Promise.all(tmp.map(promise.Existence, this)).then((arr) => {
              console.log('Created...', arr);
            }).catch((err) => {
              console.error('[ERR] Creating ', err);
            });
          }
        }
        else {
          rej(rsp.rsc);
        }
      });
      op.apply(this, args);
    });
  }

  getOrganizationDetails() {
    this.log.debug("[App] getOrganizationDetails()");
    return this.callApi('GET', 200, true, null, null);
  }

  //
  //
  //
  listAllDevicesOfType(type) {
    this.log.debug("[App] listAllDevicesOfType(" + type + ")");
    return new Promise((res, rej) => {
      this.discovery('dev/'+type, {ty: m2m.code.getResourceType('container'), lvl:1}, (rsp) => {
        if (rsp.rsc === m2m.code.getResponseStatusCode('OK')) {
          res(getPrimitiveContent(rsp).split(' ').map(e => e.split('/').pop()).sort())
        }
        else {
          rej(rsp.rsc, rsp.pc);
        }
      });
    });
  }

  //
  //
  //
  deleteDeviceType(type) {
    this.log.debug("[App] deleteDeviceType(" + type + ")");

    if (!type) {
      // type should be present
      this.log.error('[App:deleteDeviceType]', arguments);
      throw new Error('DeviceType is not specified');
    }

    return promise.Execute.call(this,
      this.delete,
      m2m.code.getResponseStatusCode('OK'),
      ['dev/' + type]
    );
  }

  //
  //
  //
  getDeviceType(type) {
    this.log.debug("[App] getDeviceType(" + type + ")");

    if (!type) {
      // type should be present
      this.log.error('[App:getDeviceType]', arguments);
      throw new Error('DeviceType is not specified');
    }

    return promise.Execute.call(this,
      this.retrieve,
      m2m.code.getResponseStatusCode('OK'),
      ['dev/' + type + '/latest']
    )
    .then((cin) => {
      return new Promise((res, rej) => {
        res(JSON.parse(cin.con));
      });
    })
  }

  //
  //
  //
  getAllDeviceTypes() {
    this.log.debug("[App] getAllDeviceTypes()");
    return promise.Execute.call(this,
      this.discovery,
      m2m.code.getResponseStatusCode('OK'),
      ['dev', {ty: m2m.code.getResourceType('container'), lvl:1, lbl: 'TYPE'}]
    ).then(uril => {
      let types = uril.split(' ').map(e => e.split('/').pop()).sort();
      return Promise.all(types.map(this.getDeviceType, this));
    });
  }

  //
  //
  //
  updateDeviceType(type, description) {
    this.log.debug("[App] updateDeviceType(" + type + ", " + description + ")");

    if (!type) {
      // type should be present
      this.log.error('[App:getDeviceType]', arguments);
      throw new Error('DeviceType is not specified');
    }

    let path = 'dev/' + type;
    
    return promise.Execute.call(this,
      this.retrieve,
      m2m.code.getResponseStatusCode('OK'),
      [path + '/la']
    ).then((cin) => {
      let body = JSON.parse(cin.con);
      body.description = description;
      return promise.Execute.call(this,
        this.publish,
        m2m.code.getResponseStatusCode('CREATED'),
        [path, body, {lbl: 'INFO'}]
      );
    });
  }

  //
  //
  //
  registerDeviceType(typeId, description) {
    this.log.debug("[App] registerDeviceType(" + typeId + ", " + description + ")");
    let body = {
      id: typeId,
      description: description
    };

    if (!typeId) {
      // typeId should be present
      this.log.error('[registerDeviceType]', arguments);
      throw new Error('DeviceType is not specified');
    }

    return promise.Execute.call(this,
      this.create,
      [ m2m.code.getResponseStatusCode('CREATED'), m2m.code.getResponseStatusCode('ALREADY_EXISTS') ],
      ['dev', {ty: m2m.code.getResourceType('container'), rn: typeId, lbl: 'TYPE'}]
    ).then((con) => {
      return promise.Execute.call(this,
        this.publish,
        m2m.code.getResponseStatusCode('CREATED'),
        ['dev/' + typeId, body, {lbl: 'INFO'}]
      );
    });
  }

  //
  //
  //
  registerDevice(type, device, authToken, deviceInfo, location) {
    this.log.debug("[App] registerDevice(" + type + ", " + device + ", " + deviceInfo + ", " + location + ")");

    let body = {
      id: device,
      authToken: authToken,
      deviceInfo: deviceInfo,
      location: location
    };

    if (!type) {
      // type should be present
      this.log.error('[registerDevice]', arguments);
      throw new Error('DeviceType is not specified');
    }

    if (!device) {
      // deviceId should be present
      this.log.error('[registerDevice]', arguments);
      throw new Error('DeviceID is not specified');
    }

    let path = 'dev/' + type;

    return promise.Execute.call(this,
      this.create,
      [ m2m.code.getResponseStatusCode('CREATED'), m2m.code.getResponseStatusCode('ALREADY_EXISTS') ],
      [path, {ty: m2m.code.getResourceType('container'), rn: device, lbl: 'DEVICE'}]
    ).then((con) =>
      Promise.all(['evt', 'cmd', 'mon'].map(e => path + '/' + device + '/' + e).map(promise.Existence, this))
    ).then((con) => {
      return promise.Execute.call(this,
        this.publish,
        m2m.code.getResponseStatusCode('CREATED'),
        [path + '/' + device, body, {lbl: 'INFO'}]
      );
    });
  }

  //
  //
  //
  unregisterDevice(type, device) {
    this.log.debug("[App] unregisterDevice(" + type + ", " + device + ")");

    if (!type) {
      // type should be present
      this.log.error('[unregisterDevice]', arguments);
      throw new Error('DeviceType is not specified');
    }

    if (!device) {
      // deviceId should be present
      this.log.error('[unregisterDevice]', arguments);
      throw new Error('DeviceID is not specified');
    }

    let path = 'dev/' + type + '/' + device;

    return promise.Execute.call(this,
      this.delete,
      m2m.code.getResponseStatusCode('OK'),
      [path]
    );
  }

  //
  //
  //
  updateDevice(type, device, deviceInfo) {
    this.log.debug("[App] updateDevice(" + type + ", " + device + ", " + deviceInfo + ")");

    if (!type) {
      // type should be present
      this.log.error('[updateDevice]', arguments);
      throw new Error('DeviceType is not specified');
    }

    if (!device) {
      // deviceId should be present
      this.log.error('[updateDevice]', arguments);
      throw new Error('DeviceID is not specified');
    }

    let path = 'dev/' + type + '/' + device;

    return promise.Execute.call(this,
      this.retrieve,
      m2m.code.getResponseStatusCode('OK'),
      [path + '/la']
    ).then((cin) => {
      let body = JSON.parse(cin.con);
      body.deviceInfo = deviceInfo;
      return promise.Execute.call(this,
        this.publish,
        m2m.code.getResponseStatusCode('CREATED'),
        [path, body, {lbl: 'INFO'}]
      );
    });
  }

  //
  //
  //
  getDevice(type, device) {
    this.log.debug("[App] getDevice(" + type + ", " + device + ")");

    if (!type) {
      // type should be present
      this.log.error('[getDevice]', arguments);
      throw new Error('DeviceType is not specified');
    }

    if (!device) {
      // deviceId should be present
      this.log.error('[getDevice]', arguments);
      throw new Error('DeviceID is not specified');
    }

    let path = 'dev/' + type + '/' + device;

    return promise.Execute.call(this,
      this.retrieve,
      m2m.code.getResponseStatusCode('OK'),
      [path + '/la']
    )
    .then((cin) => {
      return new Promise((res, rej) => {
        res(JSON.parse(cin.con));
      });
    });
  }

  // getDeviceLocation(type, deviceId) {
  //   this.log.debug("[App] getDeviceLocation(" + type + ", " + deviceId + ")");
  //   return this.callApi('GET', 200, true, ['device', 'types', type, 'devices', deviceId, 'location'], null);
  // }

  // updateDeviceLocation(type, deviceId, location) {
  //   this.log.debug("[App] updateDeviceLocation(" + type + ", " + deviceId + ", " + location + ")");

  //   return this.callApi('PUT', 200, true, ['device', 'types', type, 'devices', deviceId, 'location'], location);
  // }

  // getDeviceManagementInformation(type, deviceId) {
  //   this.log.debug("[App] getDeviceManagementInformation(" + type + ", " + deviceId + ")");
  //   return this.callApi('GET', 200, true, ['device', 'types', type, 'devices', deviceId, 'mgmt'], null);
  // }

  // getAllDiagnosticLogs(type, deviceId) {
  //   this.log.debug("[App] getAllDiagnosticLogs(" + type + ", " + deviceId + ")");
  //   return this.callApi('GET', 200, true, ['device', 'types', type, 'devices', deviceId, 'diag', 'logs'], null);
  // }

  // clearAllDiagnosticLogs(type, deviceId) {
  //   this.log.debug("[App] clearAllDiagnosticLogs(" + type + ", " + deviceId + ")");
  //   return this.callApi('DELETE', 204, false, ['device', 'types', type, 'devices', deviceId, 'diag', 'logs'], null);
  // }

  // addDeviceDiagLogs(type, deviceId, log) {
  //   this.log.debug("[App] addDeviceDiagLogs(" + type + ", " + deviceId + ", " + log + ")");
  //   return this.callApi('POST', 201, false, ['device', 'types', type, 'devices', deviceId, 'diag', 'logs'], log);
  // }

  // getDiagnosticLog(type, deviceId, logId) {
  //   this.log.debug("[App] getAllDiagnosticLogs(" + type + ", " + deviceId + ", " + logId + ")");
  //   return this.callApi('GET', 200, true, ['device', 'types', type, 'devices', deviceId, 'diag', 'logs', logId], null);
  // }

  // deleteDiagnosticLog(type, deviceId, logId) {
  //   this.log.debug("[App] deleteDiagnosticLog(" + type + ", " + deviceId + ", " + logId + ")");
  //   return this.callApi('DELETE', 204, false, ['device', 'types', type, 'devices', deviceId, 'diag', 'logs', logId], null);
  // }

  // getDeviceErrorCodes(type, deviceId) {
  //   this.log.debug("[App] getDeviceErrorCodes(" + type + ", " + deviceId + ")");
  //   return this.callApi('GET', 200, true, ['device', 'types', type, 'devices', deviceId, 'diag', 'errorCodes'], null);
  // }

  // clearDeviceErrorCodes(type, deviceId) {
  //   this.log.debug("[App] clearDeviceErrorCodes(" + type + ", " + deviceId + ")");
  //   return this.callApi('DELETE', 204, false, ['device', 'types', type, 'devices', deviceId, 'diag', 'errorCodes'], null);
  // }

  // addErrorCode(type, deviceId, log) {
  //   this.log.debug("[App] addErrorCode(" + type + ", " + deviceId + ", " + log + ")");
  //   return this.callApi('POST', 201, false, ['device', 'types', type, 'devices', deviceId, 'diag', 'errorCodes'], log);
  // }

  // getDeviceConnectionLogs(typeId, deviceId) {
  //   this.log.debug("[App] getDeviceConnectionLogs(" + typeId + ", " + deviceId + ")");
  //   let params = {
  //     type: typeId,
  //     id: deviceId
  //   };
  //   return this.callApi('GET', 200, true, ['logs', 'connection'], null, params);
  // }

  // getServiceStatus() {
  //   this.log.debug("[App] getServiceStatus()");
  //   return this.callApi('GET', 200, true, ['service-status'], null);
  // }

  // getAllDeviceManagementRequests() {
  //   this.log.debug("[App] getAllDeviceManagementRequests()");
  //   return this.callApi('GET', 200, true, ['mgmt', 'requests'], null);
  // }

  // initiateDeviceManagementRequest(action, parameters, devices) {
  //   this.log.debug("[App] initiateDeviceManagementRequest(" + action + ", " + parameters + ", " + devices + ")");
  //   let body = {
  //     action: action,
  //     parameters: parameters,
  //     devices: devices
  //   };
  //   return this.callApi('POST', 202, true, ['mgmt', 'requests'], body);
  // }

  // getDeviceManagementRequest(requestId) {
  //   this.log.debug("[App] getDeviceManagementRequest(" + requestId + ")");
  //   return this.callApi('GET', 200, true, ['mgmt', 'requests', requestId], null);
  // }

  // deleteDeviceManagementRequest(requestId) {
  //   this.log.debug("[App] deleteDeviceManagementRequest(" + requestId + ")");
  //   return this.callApi('DELETE', 204, false, ['mgmt', 'requests', requestId], null);
  // }

  // getDeviceManagementRequestStatus(requestId) {
  //   this.log.debug("[App] getDeviceManagementRequestStatus(" + requestId + ")");
  //   return this.callApi('GET', 200, true, ['mgmt', 'requests', requestId, 'deviceStatus'], null);
  // }

  // getDeviceManagementRequestStatusByDevice(requestId, typeId, deviceId) {
  //   this.log.debug("[App] getDeviceManagementRequestStatusByDevice(" + requestId + ", " + typeId + ", " + deviceId + ")");
  //   return this.callApi('GET', 200, true, ['mgmt', 'requests', requestId, 'deviceStatus', typeId, deviceId], null);
  // }

  // //Usage Management
  // getActiveDevices(start, end, detail) {
  //   this.log.debug("[App] getActiveDevices(" + start + ", " + end + ")");
  //   detail = detail | false;
  //   let params = {
  //     start: start,
  //     end: end,
  //     detail: detail
  //   };
  //   return this.callApi('GET', 200, true, ['usage', 'active-devices'], null, params);
  // }

  // getHistoricalDataUsage(start, end, detail) {
  //   this.log.debug("[App] getHistoricalDataUsage(" + start + ", " + end + ")");
  //   detail = detail | false;
  //   let params = {
  //     start: start,
  //     end: end,
  //     detail: detail
  //   };
  //   return this.callApi('GET', 200, true, ['usage', 'historical-data'], null, params);
  // }

  // getDataUsage(start, end, detail) {
  //   this.log.debug("[App] getDataUsage(" + start + ", " + end + ")");
  //   detail = detail | false;
  //   let params = {
  //     start: start,
  //     end: end,
  //     detail: detail
  //   };
  //   return this.callApi('GET', 200, true, ['usage', 'data-traffic'], null, params);
  // }

  //Historian
  getAllHistoricalEvents(evtType, start, end) {
    return this.getAllHistoricalEventsByDeviceId(evtType, start, end, null, null);
  }

  getAllHistoricalEventsByDeviceType(evtType, start, end, typeId) {
    return this.getAllHistoricalEventsByDeviceId(evtType, start, end, typeId, null);
  }

  getAllHistoricalEventsByDeviceId(evtType, start, end, typeId, deviceId) {
    this.log.debug("[App] getAllHistoricalEvents(" + evtType + ", " + start + ", " + end + ")");
    let params = {
      tag: evtType,
      start: start,
      end: end
    };
    return promise.Batch.call(this, typeId, deviceId, 'evt', params, promise.CollectDeviceMessages);
  }

  publishHTTPS(deviceType, deviceId, eventType, eventFormat, payload) {
    this.log.debug("[App:publishHTTPS] Publishing event of Type: " + eventType + " with payload : " + payload);
    return new Promise((resolve, reject) => {

      let uri = format("https://%s.messaging.%s/api/v0002/application/types/%s/devices/%s/events/%s", this.org, this.domainName, deviceType, deviceId, eventType);

      let xhrConfig = {
        url: uri,
        method: 'POST',
        data: payload,
        headers: {

        }
      };

      if (eventFormat === 'json') {
        xhrConfig.headers['Content-Type'] = 'application/json';
      } else if (eventFormat === 'xml') {
        xhrConfig.headers['Content-Type'] = 'application/xml';
      }

      xhrConfig.headers['Authorization'] = 'Basic ' + btoa(this.apiKey + ':' + this.apiToken);
      this.log.debug("[App:publishHTTPS]" + xhrConfig);

      xhr(xhrConfig).then(resolve, reject);
    });
  }

  //event cache

  //
  //
  //
  getLastEvents(type, id) {
    this.log.debug("[App] getLastEvents() - event cache");
    // return this.callApi('GET', 200, true, ["device", "types", type, "devices", id, "events"], null);
    return promise.Batch.call(this, type, id, 'evt', promise.LatestDeviceMessage);
  }

  //
  //
  //
  getLastEventsByEventType(type, id, eventType) {
    this.log.debug("[App] getLastEventsByEventType() - event cache");
    // return this.callApi('GET', 200, true, ["device", "types", type, "devices", id, "events", eventType], null);
    return promise.Batch.call(this, type, id, 'evt', {tag: eventType, lim: 1}, promise.CollectDeviceMessages);
  }

  //bulk apis

  //
  // TODO params?
  //
  getAllDevices(params) {
    this.log.debug("[App] getAllDevices() - BULK");
    return promise.Execute.call(this,
      this.discovery,
      m2m.code.getResponseStatusCode('OK'),
      ['dev', {ty: m2m.code.getResourceType('container'), lvl:2, lbl: 'DEVICE'}]
    ).then(uril => {
      let devices = uril.split(' ').map(e => { e = e.split('/'); return e.splice(e.length-2); }).sort();
      console.log(devices);
      return Promise.all(devices.map(e => this.getDevice.apply(this, e)));
    });
  }

  /**
   * Register multiple new devices, each request can contain a maximum of 512KB.
   * The response body will contain the generated authentication tokens for all devices.
   * The caller of the method must make sure to record these tokens when processing
   * the response. The IBM Watson IoT Platform will not be able to retrieve lost authentication tokens
   *
   * @param arryOfDevicesToBeAdded Array of JSON devices to be added. Refer to
   * <a href="https://docs.internetofthings.ibmcloud.com/swagger/v0002.html#!/Bulk_Operations/post_bulk_devices_add">link</a>
   * for more information about the schema to be used
   */
  registerMultipleDevices(arryOfDevicesToBeAdded) {
    this.log.debug("[App] arryOfDevicesToBeAdded() - BULK");
    return Promise.all(arryOfDevicesToBeAdded.map(info => {
      let report = success => { return { typeId: info.typeId, deviceId: info.deviceId, success: success} };
      return this.registerDevice.apply(this,
        [info.typeId, info.deviceId, info.authToken, info.deviceInfo, info.location]
      ).then(
        () => report(true)
      ).catch(
        () => report(false)
      );
    }));
  }

  /**
  * Delete multiple devices, each request can contain a maximum of 512Kb
  *
  * @param arryOfDevicesToBeDeleted Array of JSON devices to be deleted. Refer to
  * <a href="https://docs.internetofthings.ibmcloud.com/swagger/v0002.html#!/Bulk_Operations/post_bulk_devices_remove">link</a>
  * for more information about the schema to be used.
  */
  deleteMultipleDevices(arryOfDevicesToBeDeleted) {
    this.log.debug("[App] deleteMultipleDevices() - BULK");
    return Promise.all(arryOfDevicesToBeDeleted.map(info => {
      let report = success => { return { typeId: info.typeId, deviceId: info.deviceId, success: success} };
      return this.unregisterDevice.apply(this, 
        [info.typeId, info.deviceId]
      ).then(
        () => report(true)
      ).catch(
        () => report(false)
      );
    }));
  }
}

module.exports = App;