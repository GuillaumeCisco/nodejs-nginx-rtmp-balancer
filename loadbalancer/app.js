var _ = require('lodash');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require("fs");
var configuration = JSON.parse(
    fs.readFileSync("config.json")
);

var helpers = require('./utils/helpers.js');
var client = require('./utils/redis.js');
client.on("error", function (err) {
    console.log("Error " + err);
});

var http = require('http');
var app = express();
var router = express.Router();

//App sets
var port = normalizePort(process.env.PORT || configuration.port);
app.set('port', port);
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());

//CORS middleware
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
};
app.use(allowCrossDomain);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', router);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

//Socket initialization / Network
var server = http.createServer(app);
var io = require('socket.io')(server);
server.listen(port);

io.on('connection', function (socket) {
    socket.on('sendserver', function (packet) {
        if (packet.security.key === configuration.key) {
            packet.edge.timestamp = Date.now();

            client.hget(packet.edge.ip, function (err, reply) {
                if (typeof reply === 'undefined') {

                    var data = [];
                    for (var i = 0, l = packet.edge.length; i < l; i++) {
                        data.push(i);
                        data.push(packet.edge[i]);
                    }
                    client.hmset(packet.edge.ip, data, function (err, res) {})
                }
            });

            if (packet.edge.type === 'publisher') {
                client.zadd('publishers', packet.edge.clients, packet.edge.ip);
            }
            else {
                client.zadd('broadcasters', packet.edge.clients, packet.edge.ip);
            }

            socket.emit('serverUpdated', {updated: 'OK'});
        } else {
            socket.emit('serverUpdated', {updated: 'FAIL -> Security Key Invalid'});
        }
    });
});

router.get('/freepublisher', function (req, res, next) {

    client.zrevrangeAsync('publishers', '-1', '-1').then(function (data) {
        res.status(200).json({
            ip: data[0]
        });
    });
});

router.get('/freebroadcaster', function (req, res, next) {

    client.zrevrangeAsync('broadcasters', '-1', '-1').then(function (data) {
        res.status(200).json({
            ip: data[0]
        });
    });
});

router.post('/remote_redirect', function (req, res, next) {
    // get publisher who publish this stream
    helpers.getPublisherFromStream(req.body['name']).then(function (data) {
        res.redirect(302, 'rtmp://' + data + '/publish/' + req.body['name']);
    }, function () {
        res.status(404).json({
            message: 'No publisher found for this stream.'
        });
    });
});

router.post('/on_publish', function (req, res, next) {

    var room = req.body['name'],
        publisher_ip = req.body['tcurl'].match(/rtmp:\/\/([^\/]*)/)[1];

    // add room to publisher if not present in it
    helpers.addStream(room, publisher_ip);

    // get publisher who publish this stream
    res.status(200).json({
        message: 'on_publish',
        ip: publisher_ip
    });

});

router.post('/on_publish_done', function (req, res, next) {
    // get publisher who publish this stream
    var room = req.body['name'],
        publisher_ip = req.body['tcurl'].match(/rtmp:\/\/([^\/]*)/)[1];

    // remove room from publisher_ip
    helpers.removeStream(room, publisher_ip);

    res.status(200).json({
        message: 'on_publish_done',
        ip: publisher_ip
    });

});

module.exports = app;
