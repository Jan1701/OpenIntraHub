const EventEmitter = require('events');
class CoreEventBus extends EventEmitter {}
const eventBus = new CoreEventBus();
module.exports = eventBus;
