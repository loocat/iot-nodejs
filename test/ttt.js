
var test = (t) => {
  console.log('!' + t + ' = ' + !t);
  console.log('!!' + t + ' = ' + !!t);
}
test('');
test(0);
test(null);
test(false);
test(undefined);

// console.log(require('url').parse('mqtt://koprebbo:rdHrHnXjkZDG@m12.cloudmqtt.com:16452'));
// console.log(require('url').parse('mysql://b5a5e5b16ae54b:7ad40749@us-cdbr-iron-east-04.cleardb.net/heroku_61ad96e65e8dec3?reconnect=true'));
// return;

let topicClass = '/oneM2M';
let topicRE = new RegExp('^' + topicClass + '/(req|resp)/*');
console.log(topicRE);
[
  '/oneM2M/req/aaa',
  '/oneM2M/resp/aaa',
  '/oneM2M/cse/aaa',
  '/oneM2M/req/aaa/',
  '/oneM2M/resp/aaa/',
  '/oneM2M/cse/aaa/',
  '/oneM2M/req/aaa/bbb',
  '/oneM2M/resp/aaa/bbb',
  '/oneM2M/cse/aaa/bbb',
  '/oneM2M/req/aaa/bbb/ccc',
  '/oneM2M/resp/aaa/bbb/ccc',
  '/oneM2M/cse/aaa/bbb/ccc',
  '/oneM2M/req/aaa/bbb/ccc/ddd',
  '/oneM2M/resp/aaa/bbb/ccc/ddd',
  '/oneM2M/cse/aaa/bbb/ccc/ddd',
].map(e => console.log(topicRE.test(e), e));
// return;

var delay = (amount, callback) => {
  return new Promise((res, rej) => {
    setTimeout(() => { if (callback) callback(); res(); }, amount);
  });
}

let show = t => console.log(JSON.stringify(t, null, ' '))

// let org = 'mn-cse';
// let aeid = 'ae-20c78065-6a65-4bd2-9c79-e2c350f454e4';
// let url = {
//   protocol: 'mqtt:',
//   auth: 'username:password',
//   hostname: 'localhost',
//   port: '1883',
//   pathname: require('util').format('/%s/%s', org, aeid),
//   slashes: true
// };

// [heroku]
let org = 'mn-cse';
let aeid = 'ae-eafc7082-72da-45e4-b073-ce34afe96d65';
let url = {
  protocol: 'mqtt:',
  auth: 'thgprlao:HYDMWTisKnbC',
  hostname: 'm13.cloudmqtt.com',
  port: '18569',
  pathname: require('util').format('/%s/%s', org, aeid),
  slashes: true
}

var config = {
  base: {
    url: require('url').format(url),
    // logLevel: 'warn'
  },
  dev: {
    url: require('url').format(url),
    type: 'devtype'
  },
  app: {
    url: require('url').format(url),
    // logLevel: 'warn'
  }
}

var lib = require('../src/index');
// var lib = require('../dist/index');
// var client = new lib.base(config.base);
// var client = new lib.device(config.dev);
var client = new lib.application(config.app);

let aaa = Reflect.ownKeys(Reflect.getPrototypeOf(client));
aaa.map(key => console.log(key, typeof client[key], client[key] instanceof Function));
let fre = /^([^(]+)\(([^)]+)\)/;
aaa.map(key => {
  let rrr = fre.exec(client[key].toString());
  if (rrr) {
    console.log(typeof rrr);
    // console.log(Object.keys(rrr));
    console.log(key, rrr[2].split(',').map(e => e.trim()));
  }
});
return;

client.connect(1, () => {
  // // client.retrieve('', console.log);
  // client.discovery('', {ty:3}, (rsp) => {
  // // console.log(Object.keys(client.subscriptions));
  //   rsp.pc.uril.split(' ').forEach((e) => {
  //     // console.log(e);
  //     // client.subscribe(e);
  //     client.unsubscribe(e);
  //   });
  // });
  // return;

  var m2m = require('onem2m');

  var getPrimitiveContent = rsp => rsp.pc[Object.keys(rsp.pc)[0]];

  let type = 'typeE';
  let id = 'e1';
  let event = 'RR';
  let description = 'Device Type Description';
  let deviceInfo = 'Device Information';
  let metadata;
  let classId;
  let authToken = 'token';
  let location = 'location';
  let status;
  let extensions = '';
  let logId;
  let log;
  let requestId;
  let action, parameters;
  let devices = [
    {typeId: 'typeK', deviceId: 'k1'},
    {typeId: 'typeK', deviceId: 'k2'},
    {typeId: 'typeK', deviceId: 'k3'},
    {typeId: 'typeK', deviceId: 'k4'},
    {typeId: 'typeK', deviceId: 'k5'},
    {typeId: 'typeK', deviceId: 'k6'},
    {typeId: 'typeM', deviceId: 'm1'},
    {typeId: 'typeM', deviceId: 'm2'},
    {typeId: 'typeM', deviceId: 'm3'},
    {typeId: 'typeM', deviceId: 'm4'},
    {typeId: 'typeM', deviceId: 'm5'},
    {typeId: 'typeM', deviceId: 'm6'},
  ];
  let start = '20170104T000000';
  // let end = '20170110T000000';
  let end = '20170104T183026';
  let detail;

  // client.subscribeToDeviceEvents(type, id, event);
  // client.unsubscribeToDeviceEvents(type, id, event);

  // client.subscribeToDeviceEvents(type, id);
  // client.unsubscribeToDeviceEvents(type, id);

  // client.subscribeToDeviceEvents(type, null, event);
  // client.unsubscribeToDeviceEvents(type, null, event);

  // client.subscribeToDeviceEvents(null, null, event);
  // client.unsubscribeToDeviceEvents(null, null, event);

  // client.subscribeToDeviceEvents(null, null, null);
  // client.unsubscribeToDeviceEvents(null, null, null);

  // client.registerMultipleDevices(devices).then((rrr) => {
  //   console.log(rrr);
  //   let d0 = devices[0];
  //   return client.unregisterDevice(d0.typeId, d0.deviceId);
  // }).then((response) => {
  //   return client.deleteMultipleDevices(devices);
  // }).then(console.log).catch(console.error);

  let subscribe = 'subscribeToDeviceEvents';
  let unsubscribe = 'unsubscribeToDeviceEvents';
  let publish = 'publishDeviceEvent';
  // let subscribe = 'subscribeToDeviceCommands';
  // let unsubscribe = 'unsubscribeToDeviceCommands';
  // let publish = 'publishDeviceCommand';
  let amount = 4000;

  // id = null;

  // client.registerDeviceType(type, description).then(console.log).catch(console.error);
  // client.registerDevice(type, id, authToken, deviceInfo, location).then(console.log).catch(console.error);

  delay(amount, () => client[unsubscribe](type, id, null)).then(() =>
    delay(amount, () => { client[subscribe](type, id, event); })
  )
  .then(() =>
    delay(amount, () => { client[subscribe](type, id, 'FF'); })
  )
  .then(() =>
    delay(amount, () => { client[subscribe](type, id, 'GG'); })
  )
  .then(() =>
    delay(amount, () => { client[unsubscribe](type, id, 'FF'); })
  )
  .then(() =>
    delay(amount, () => { client[unsubscribe](type, id, 'GG'); })
  )
  .then(() =>
    delay(amount, () => { client[publish](type, id, event, 'Notification is expected.', 2); })
  )
  .then(() =>
    delay(amount, () => { client[publish](type, id, 'FF', 'Notification is not expected.'); })
  )
  .then(() =>
    delay(amount, () => { client[subscribe](type, id); })
  )
  .then(() =>
    delay(amount, () => { client[publish](type, id, 'XX', 'Notification is expected.', 2); })
  )
  .then(() =>
    console.log('FIN')
  );

  // client.getOrganizationDetails().then(console.log).catch(console.error);
  // client.listAllDevicesOfType(type).then(console.log).catch(console.error); // DONE
  // client.deleteDeviceType(type).then(console.log).catch(console.error); // DONE
  // client.getDeviceType(type).then(console.log).catch(console.error); // DONE
  // client.getAllDeviceTypes().then(console.log).catch(console.error); // DONE
  // client.updateDeviceType(type, description, deviceInfo).then(console.log).catch(console.error); // DONE
  // client.registerDeviceType(type, description).then(console.log).catch(console.error); // DONE
  // client.registerDevice(type, id, authToken, deviceInfo, location).then(console.log).catch(console.error); // DONE
  // client.unregisterDevice(type, id).then(console.log).catch(console.error); // DONE
  // client.updateDevice(type, id, deviceInfo, status, metadata, extensions).then(console.log).catch(console.error); // DONE
  // client.getDevice(type, id).then(console.log).catch(console.error); // DONE
  //- client.getDeviceLocation(type, id).then(console.log).catch(console.error);
  //- client.updateDeviceLocation(type, id, location).then(console.log).catch(console.error);
  //- client.getDeviceManagementInformation(type, id).then(console.log).catch(console.error);
  //- client.getAllDiagnosticLogs(type, id).then(console.log).catch(console.error);
  //- client.clearAllDiagnosticLogs(type, id).then(console.log).catch(console.error);
  //- client.addDeviceDiagLogs(type, id, log).then(console.log).catch(console.error);
  //- client.getDiagnosticLog(type, id, logId).then(console.log).catch(console.error);
  //- client.deleteDiagnosticLog(type, id, logId).then(console.log).catch(console.error);
  //- client.getDeviceErrorCodes(type, id).then(console.log).catch(console.error);
  //- client.clearDeviceErrorCodes(type, id).then(console.log).catch(console.error);
  //- client.addErrorCode(type, id, log).then(console.log).catch(console.error);
  //- client.getDeviceConnectionLogs(type, id).then(console.log).catch(console.error);
  //- client.getServiceStatus().then(console.log).catch(console.error);
  //- client.getAllDeviceManagementRequests().then(console.log).catch(console.error);
  //- client.initiateDeviceManagementRequest(action, parameters, devices).then(console.log).catch(console.error);
  //- client.getDeviceManagementRequest(requestId).then(console.log).catch(console.error);
  //- client.deleteDeviceManagementRequest(requestId).then(console.log).catch(console.error);
  //- client.getDeviceManagementRequestStatus(requestId).then(console.log).catch(console.error);
  //- client.getDeviceManagementRequestStatusByDevice(requestId, type, id).then(console.log).catch(console.error);
  //- client.getActiveDevices(start, end, detail).then(console.log).catch(console.error);
  //- client.getHistoricalDataUsage(start, end, detail).then(console.log).catch(console.error);
  //- client.getDataUsage(start, end, detail).then(console.log).catch(console.error);
  // client.getAllHistoricalEvents(event, start, end).then(show).catch(console.error); // DONE
  // client.getAllHistoricalEventsByDeviceType(event, start, end, type).then(show).catch(console.error); // DONE
  // client.getAllHistoricalEventsByDeviceId(event, start, end, type, id).then(show).catch(console.error); // DONE
  // client.getLastEvents(type, id).then(console.log).catch(console.error);
  // client.getLastEventsByEventType(type, id, event).then(console.log).catch(console.error);
  // client.getAllDevices(parameters).then(console.log).catch(console.error); // DONE
  // client.registerMultipleDevices(devices).then(console.log).catch(console.error); // DONE
  // client.deleteMultipleDevices(devices).then(console.log).catch(console.error); // DONE
})
.on('deviceEvent', (msg) => {
  console.log('--------DEVICE_EVENT--------');
  console.dir(msg);
})
.on('deviceCommand', (msg) => {
  console.log('-------DEVICE_COMMAND-------');
  console.dir(msg);
})

