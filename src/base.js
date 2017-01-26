var events = require('events');
var mqtt = require('mqtt');
var log = require('loglevel');
var m2m = require('onem2m');

var util = require('./util');
var isDefined = util.isDefined;
var isString = util.isString;
var isNode = util.isNode;

var definedAndString = (x) => {
  return (isDefined(x) && isString(x));
}

var check = (map, key, cond) => {
  return (map && cond(map[key]));
}

let getPrimitiveContent = rsp => rsp.pc[Object.keys(rsp.pc)[0]];
let label2words = lbl => (Array.isArray(lbl) ? lbl : lbl.split(' ')).map(e => e.trim()).filter(e => !!e);

var priv = {
  //
  // publish an oneM2M request primitive
  //
  // prepare
  // 1. topic: /oneM2M/req/{my_id}/{cse_id}/json
  // 2. options: { qos: ? }
  // 3. rqp: oneM2M request primitive
  //
  sendRequest: function (op, path, what, options, callback) {
    if (typeof options === 'function') {
      if (!callback) {
        callback = options;
        options = undefined;
      }
    }
    let rqp = {
      rqi: priv.getRequestId.call(this),
      to: priv.path2uri.call(this, path),
      fr: priv.path2uri.call(this, ''),
      op: op
    };
    let mqttOption = { qos: 0 };
    if (options && options.qos) {
      mqttOption.qos = options.qos;
      delete options.qos;
      if (Object.keys(options).length < 1) {
        options = undefined;
      }
    }
    if (options) {
      Object.keys(options).map(key => rqp[key] = options[key]);
    }
    if (what) {
      if (what.fu === m2m.code.getFilterUsage('Discovery Criteria')) {
        rqp.fc = what;
      }
      else if (what.ty) {
        rqp.pc = m2m.util.wrapMessage(m2m.code.getResourceType(what.ty), what);
      }
    }
    if (op === m2m.code.getOperation('Create') || op === m2m.code.getOperation('Update')) {
      rqp.ty = what.ty;
      delete what.ty;
    }
    // console.log(this.topic.out.request, rqp);
    if (!this.isConnected) {
      throw new Error('[Base:sendRequest] Client is not connected');
    }
    this.mqtt.publish(this.topic.out.request, JSON.stringify(rqp), mqttOption, () => {
      this.log.debug('[Base:sendRequest] ' + rqp.rqi);
      this.rqps[rqp.rqi] = callback;
    });
  },

  //
  // publish an oneM2M response primitive
  //
  // prepare
  // 1. topic: /oneM2M/resp/{my_id}/{cse_id}/json
  // 2. options: { qos: ? }
  // 3. rqp: oneM2M response primitive
  //
  sendResponse: function (rqp) {
    var rsp = {
      rqi: rqp.rqi,
      fr: rqp.to,
      to: rqp.fr,
      rsc: m2m.code.getResponseStatusCode('OK')
    };
    if (!this.isConnected) {
      throw new Error('[Base:sendResponse] Client is not connected');
    }
    this.mqtt.publish(this.topic.out.response, JSON.stringify(rsp), () => {
      this.log.debug('[Base:sendResponse] ' + rsp.rqi);
    });
  },

  //
  // {path} --> /{cse_id}/{ae_id}/{path}
  //
  path2uri(path) {
    if (path && m2m.util.determineResourceAddressingMethod(path) !== m2m.code.getResourceAddressingMethod('CSE-Relative')) {
      return path;
    }
    return require('util').format('/%s/%s', this.org, this.id + (path ? '/' + path : ''));
  },

  //
  // rqi: {id}/{seq}
  //
  getRequestId() {
    if (!isDefined(this.seq)) this.seq = 0;
    return (this.id + '/' + this.seq++);
  }
}

class Base extends require('events').EventEmitter {
  constructor(config) {
    super();

    if (!config) {
      throw new Error('[Base:constructor] Client instantiated with missing properties');
    }

    this.log = log;
    this.log.setDefaultLevel(config.logLevel || 'debug');

    if (!check(config, 'url', definedAndString)) {
      throw new Error('[Base:constructor] url must exist and be a string');
    }

    let url = require('url').parse(config.url);

    this.mqttConfig = {};
    if (url.auth) {
      let arr = url.auth.split(':');
      this.mqttConfig.username = arr[0];
      this.mqttConfig.password = arr[1];
      delete url.auth;
    }

    if (url.path) {
      let arr = url.path.split('/');
      if (arr[1]) this.org = arr[1];
      if (arr[2]) this.id = arr[2];
    }

    this.host = require('url').format(url);

    if (!this.org) {
      if (!check(config, 'org', definedAndString)) {
        throw new Error('[Base:constructor] org must exist and be a string');
      }
      this.org = config.org;
    }

    if (!this.id) {
      if (!check(config, 'id', definedAndString)) {
        throw new Error('[Base:constructor] id must exist and be a string');
      }
      this.id = config.id;
    }

    if (!this.mqttConfig.password && !isDefined(config['auth-token'])) {
      throw new Error('[Base:constructor] config must contain auth-token');
    }
    else {
      if (!isDefined(config['auth-method'])) {
        config['auth-method'] = 'token';
      }
      else if (!isString(config['auth-method'])) {
        throw new Error('[Base:constructor] auth-method must be a string');
      }
    }
    
    if (config['auth-method'] !== 'token') {
      throw new Error('[Base:constructor] unsupported authentication method' + config['auth-method']);
    }

    var topic = (dir, fr, to, fmt) => {
      return require('util').format('/oneM2M/%s/%s/%s/%s', dir, fr, to, fmt || 'json');
    }

    this.topic = {
      out: {
        request: topic('req', this.id, this.org),
        response: topic('resp', this.id, this.org)
      },
      in: [
        (config.share ? 'share:' + this.id + ':' : '') + topic('req', this.org, this.id, '#'),
        topic('resp', this.org, this.id, '#')
      ]
    };

    this.subName = 's-' + this.id;
    this.subs = [];
    this.rqps = {};

    //   if (isNode()) {
    //     this.mqttConfig.caPaths = [__dirname + '/crossflow.pem'];
    //   }

    this.mqttConfig.connectTimeout = 90 * 1000;
    this.retryCount = 0;
    this.isConnected = false;
  }

  setKeepAliveInterval(keepAliveInterval) {
    this.mqttConfig.keepalive = keepAliveInterval || 60;
    this.log.debug("[Base:setKeepAliveInterval] Connection Keep Alive Interval value set to " + this.mqttConfig.keepalive + " Seconds");
  }

  setCleanSession(cleanSession) {
    if (!isBoolean(cleanSession) && cleanSession !== 'true' && cleanSession !== 'false') {
      this.log.debug("[Base:setCleanSession] Value given for cleanSession is " + cleanSession + " , is not a Boolean, setting to true");
      cleanSession = true;
    }
    this.mqttConfig.clean = cleanSession;
    this.log.debug("[Base:setCleanSession] Connection Clean Session value set to " + this.mqttConfig.clean);
  }

  connect(qos, callback) {
    if (!Number.isInteger(qos)) { qos = 2; }

    this.log.info("[Base:connect] Connecting " + this.host);

    this.mqtt = mqtt.connect(this.host, this.mqttConfig);

    this.mqtt.on('connect', () => {
      this.log.info('[Base:connect] connected.');
      this.mqtt.subscribe(this.topic.in, { qos: qos }, (err, granted) => {
        this.log.debug('[Base:connect] ', granted);
        if (callback) callback();
      });
    });

    this.mqtt.on('message', (topic, message) => {
      m2m.util.processData(message.toString(), (msg) => {
        if (!msg) {
          this.log.warn('no primitive:', message.toString());
        }
        else if (!msg.rqi) {
          this.log.warn('no primitive parameter \'rqi\':', msg);
        }
        else if (!msg.fr) {
          this.log.warn('no primitive parameter \'fr\':', msg);
        }
        else if (!msg.to) {
          this.log.warn('no primitive parameter \'to\':', msg);
        }
        else if (msg.rsc) {
          this.handleResponse(msg);
        }
        else if (msg.op) {
          this.handleRequest(msg);
        }
        else {
          this.log.warn('invalid primitive:', msg);
        }
      });
    });

    this.mqtt.on('offline', () => {
      this.log.warn("[Base:connect] Retrying connection");

      this.isConnected = false;
      this.retryCount++;

      if (this.retryCount < 5) {
        this.log.debug("[Base:connect] Retry in 3 sec. Count : " + this.retryCount);
        this.mqtt.options.reconnectPeriod = 3000;
      } else if (this.retryCount < 10) {
        this.log.debug("[Base:connect] Retry in 10 sec. Count : " + this.retryCount);
        this.mqtt.options.reconnectPeriod = 10000;
      } else {
        this.log.debug("[Base:connect] Retry in 60 sec. Count : " + this.retryCount);
        this.mqtt.options.reconnectPeriod = 60000;
      }
    });

    this.mqtt.on('close', () => {
      this.log.info("[Base:onClose] Connection was closed.");
      this.isConnected = false;
      this.emit('disconnect');
    });

    this.mqtt.on('error', (error) => {
      this.log.error("[Base:onError] Connection Error :: " + error);
      this.isConnected = false;
      this.emit('error', error);
    });
  }

  disconnect() {
    if (!this.isConnected) {
      if (this.mqtt) {
        // The client is disconnected, but the reconnect thread
        // is running. Need to stop it.
        this.mqtt.end(true, () => { });
      }
      throw new Error("[Base:disconnect] Client is not connected");
    }

    this.isConnected = false;
    this.mqtt.end(false, () => {
      this.log.info("[Base:disconnect] Disconnected from the client.");
    });

    delete this.mqtt;
  }

  //
  // create or update oneM2M subscription at a container 'path'
  //
  subscribe(path, opt, callback) {
    if (typeof opt === 'function' && !callback) {
      callback = opt;
      opt = undefined;
    }
    this.retrieve(path + '/' + this.subName, (rsp) => {
      if (rsp.rsc === m2m.code.getResponseStatusCode('OK') && rsp.pc) {
        let enc = getPrimitiveContent(rsp).enc;
        let lbl = enc.atr.lbl;
        if (!opt.lbl) {
          if (lbl) {
            // subscribe to any
            this.updateSubscription(path, undefined, callback);
          }
          else {
            if (callback) callback(rsp);
          }
        }
        else if (lbl) {
          opt.lbl = label2words(opt.lbl);
          lbl = label2words(lbl).filter(e => opt.lbl.indexOf(e) < 0);
          lbl = lbl.concat(opt.lbl).sort();
          this.updateSubscription(path, lbl.join(' '), callback);
        }
        else {
          this.updateSubscription(path, label2words(opt.lbl).join(' '), callback);
        }
      }
      else {
        this.createSubscription(path, opt ? opt.lbl : undefined, callback);
      }
    });
  }

  createSubscription(path, lbl, callback) {
    this.create(path, {
      ty: m2m.code.getResourceType('subscription'),
      rn: this.subName,
      nu: this.host,
      lbl: lbl,
      enc: {
        om: { opr:m2m.code.getOperation('Create') },
        atr: {
          ty: m2m.code.getResourceType('contentInstance'),
          lbl: lbl
        }
      }
    },
    callback || ((rsp) => {
      this.log.info('[Base:subscribe] create ' + path + ' ... ' + m2m.code.getResponseStatusCode(rsp.rsc));
      this.log.debug('CREATE SUBSCRIPTION:', lbl);
    }));
  }

  updateSubscription(path, lbl, callback) {
    this.update(path + '/' + this.subName, {
      ty: m2m.code.getResourceType('subscription'),
      nu: this.host,
      lbl: lbl,
      enc: {
        om: { opr:m2m.code.getOperation('Create') },
        atr: {
          ty: m2m.code.getResourceType('contentInstance'),
          lbl: lbl
        }
      }
    },
    (rsp) => {
      if (rsp.rsc === m2m.code.getResponseStatusCode('NOT_FOUND')) {
        this.createSubscription(path, lbl, callback);
      }
      else if (callback) {
        callback(rsp);
      }
      else {
        this.log.info('[Base:subscribe] update ' + path + ' ... ' + m2m.code.getResponseStatusCode(rsp.rsc));
        this.log.debug('UPDATE SUBSCRIPTION:', lbl);
      }
    });
  }

  //
  // remove or update oneM2M subscription at a container 'path'
  //
  unsubscribe(path, opt, callback) {
    if (typeof opt === 'function' && !callback) {
      callback = opt;
      opt = undefined;
    }
    this.retrieve(path + '/' + this.subName, (rsp) => {
      if (rsp.rsc === m2m.code.getResponseStatusCode('OK')) {
        if (!opt || !opt.lbl) {
          removeSubscription();
        }
        else if (rsp.pc) {
          let enc = getPrimitiveContent(rsp).enc;
          let lbl = enc.atr.lbl;
          if (lbl) {
            lbl = label2words(lbl);
            opt.lbl = label2words(opt.lbl);
            lbl = lbl.filter(e => opt.lbl.indexOf(e) < 0).join(' ');
          }
          if (lbl) {
            this.updateSubscription(path, lbl, callback);
          }
          else {
            removeSubscription();
          }
        }
        else {
          if (callback) callback(rsp);
        }
      }
      else {
        if (callback) callback(rsp);
      }
    })

    let removeSubscription = () => {
      this.delete(path + '/' + this.subName,
      callback || ((rsp) => {
        this.log.info('[Base:unsubscribe] ' + path + ' ... ' + m2m.code.getResponseStatusCode(rsp.rsc));
        this.log.debug('REMOVE SUBSCRIPTION');
      }));
    }
  }

  //
  // create an oneM2M contentInstance
  //
  // prepare
  // 1. obj: oneM2M contentInstance
  //
  publish(path, msg, options, callback) {
    var obj = {
      ty: m2m.code.getResourceType('contentInstance'),
      con: (typeof msg !== 'string') ? JSON.stringify(msg) : msg,
      cnf: 'text/plain:0',
      lbl: options ? options.lbl : undefined
    };
    if (obj.lbl) delete options.lbl;
    this.create(path, obj, options, callback || ((rsp) => {
      this.log.info('[Base:publish] ' + path + ' ... ' + m2m.code.getResponseStatusCode(rsp.rsc));
    }));
  }

  handleRequest(rqp) {
    priv.sendResponse.call(this, rqp);
    // console.log(JSON.stringify(rqp, null, ' '));
    if (rqp.op === m2m.code.getOperation('Notify') && rqp.pc) {
      let sgn = getPrimitiveContent(rqp);
      let sub = sgn[m2m.name.getShort('subscriptionReference')];
      this.retrieve(sub, (rsp) => {
        // console.log(JSON.stringify(getPrimitiveContent(rsp), null, ' '));
        let subRN = getPrimitiveContent(rsp).rn;
        this.discovery('/' + this.org + '/' + getPrimitiveContent(rsp).pi, {ty: 23, lvl:1}, (rsp) => {
          // console.log(JSON.stringify(rsp, null, ' '));
          let name;
          getPrimitiveContent(rsp).split(' ').map(e => {
            e = e.split('/');
            if (e.pop() === subRN) {
              let getName = (e) => {
                if (e === 'evt') return 'Event';
                if (e === 'cmd') return 'Command';
                if (e === 'mon') return 'Status';
                return e;
              }
              name = (e.indexOf('dev') < 0 ? 'app' : 'device') + getName(e.pop());
            }
          });
          let nev = sgn[m2m.name.getShort('notificationEvent')];
          if (name && nev && nev.cin && nev.cin.con) {
            let msg = {
              name: name,
              type: nev.cin.lbl,
              data: nev.cin.con
            };
            try {
              msg.data = JSON.parse(msg.data);
            }
            catch (e) {
              // ignore exception
            }
            this.emit(name, msg);
          }
        });
      });
    }
  }

  handleResponse(rsp) {
    var callback = this.rqps[rsp.rqi];
    if (callback) {
      if (typeof callback === 'function') callback(rsp);
      delete this.rqps[rsp.rqi];
    }
    else {
      throw new Error('[ERR] no callback handler for rqi: ' + rsp.rqi);
    }
  }

  create(path, what, options, callback) {
    priv.sendRequest.call(this, m2m.code.getOperation('Create'), path, what, options, callback);
  }

  retrieve(path, options, callback) {
    priv.sendRequest.call(this, m2m.code.getOperation('Retrieve'), path, null, options, callback);
  }

  update(path, what, options, callback) {
    priv.sendRequest.call(this, m2m.code.getOperation('Update'), path, what, options, callback);
  }

  delete(path, options, callback) {
    priv.sendRequest.call(this, m2m.code.getOperation('Delete'), path, null, options, callback);
  }

  discovery(path, fc, callback) {
    if (typeof fc === 'function') {
      callback = fc;
      fc = undefined;
    }
    if (!fc) fc = {};
    if (fc.fu !== m2m.code.getFilterUsage('Discovery Criteria')) {
      fc.fu = m2m.code.getFilterUsage('Discovery Criteria');
    }
    priv.sendRequest.call(this, m2m.code.getOperation('Retrieve'), path, fc, callback);
  }
}

module.exports = Base;