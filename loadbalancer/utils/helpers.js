var _ = require('lodash');
var publishers = require('../collections/publishers.js');
var client = require('./redis.js');

module.exports = {
    addStream: function(stream, ip) {
        client.get(stream, function (err, reply) {
            if (!reply) {
                client.set(stream, ip);
            }
        });
    },
    removeStream: function(stream, ip) {

        client.get(stream, function (err, reply) {
            if (typeof reply !== 'undefined') {
                client.del(stream);
            }
        });
    },
    getPublisherFromStream: function(stream) {
        return client.getAsync(stream); // promise
    }
};

//this.multi = client.multi();
//this.multi.pubsub('NUMSUB', channel, _.bind(function (err, reply) {
//    var num_subscribers = parseInt(reply[1]);
//
//    if (typeof user !== 'undefined' && user && num_subscribers <= user.sockets.length) { // friend sockets are connected on same server
//        user.emit(event, data);
//    }
//    else if (num_subscribers) {  // friend has sockets on other servers
//        client.publish(channel, JSON.stringify({  // publish to channel friend if exist for warning him
//            'type': event,
//            'data': data
//        }));
//    }
//    else {
//        // not reachable
//    }
//
//    if (_.isFunction(callback)) { // execute callback if exist
//        callback(num_subscribers);
//    }
//
//}, this));
//this.multi.exec();
