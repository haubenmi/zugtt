var i2c = require('i2c-bus');
var morgan = require('morgan');

i2c1 = i2c.openSync(1);

var express = require('express');
var app = express();

app.use(morgan("dev"));

//app.get('/', function (req, res) {
 // res.sendFile(__dirname + '/assets/index.html');
//});

var serverPort = 80;
var portsPerModule = 16;
var portsPerRow = 8;
var iodirPorts = [0x00,0x01];
var gpioPorts = [0x14,0x15];
var modules = [0x20,0x21,0x22,0x23];
var registers = {};
var beepLength = 800;

modules = i2c1.scanSync();
console.log(modules);
var totalNumberOfPorts = portsPerModule * modules.length;
console.log("#ports: " + totalNumberOfPorts);

for(var i in modules) {
  registers[i] = {};
  for(var r in iodirPorts) {
   //set to output ports
   i2c1.writeByteSync(modules[i],iodirPorts[r],0x00);
  }
  for(var gpio in gpioPorts) {
    registers[i][gpio] = 0x00;
    i2c1.writeByteSync(modules[i],gpioPorts[gpio],0x00);
  }
}
console.log(registers);

function setBit(org,digit,val) {
  if(digit >= 8 || digit < 0) {
    throw "can only set bits in a one byte wide register";
  }
  if(org < 0 || org > 255) {
    throw "invalid input register";
  }
  var a = org;
  var b = 1 << digit;
  if(val === false) {
    b = ~b;
    return a & b;
  }
  return a | b;
};
function getBit(org,digit) {
  if(digit < 0 || digit > 7) {
    throw "can only get bits in a one byte wide register";
  }
  if(org < 0 || org > 255) {
    throw "invalid input register";
  }
  var a = org >> digit;
  var d = a & 0x1;
  return !!d;
}
function getAddressForPort(port) {
  
	if(port >= 0 && port < totalNumberOfPorts) {
		var module = Math.floor(port / portsPerModule);
		var rest = port % portsPerModule;
		var row = Math.floor(rest / portsPerRow);
		var port = rest % portsPerRow;
    return {
      module : module,
      row : row,
      port : port
    };  

  } else {
    return {
      module : 0,
      row : 0,
      port : 0
    };
  }
};
function turnPort(regs,port,val) {
  var addr = getAddressForPort(port);
  if(addr.err) {
    console.log(addr.err);
  } else {
    console.log("addr: ");
    console.log(addr);
    console.log("newVal: " + val);
    if(regs && typeof(regs[addr.module]) !== "undefined"
    && typeof(regs[addr.module][addr.row]) != "undefined") {
      var oldReg = regs[addr.module][addr.row];
      var newReg = setBit(oldReg,addr.port,val);
      regs[addr.module][addr.row] = newReg; 
      i2c1.writeByteSync(modules[addr.module],gpioPorts[addr.row],newReg);
    } else {
      console.log(regs);
      console.log(addr);
      
      console.log("could net write to i2c because invalid value");
    }
  }

};
function turnPortOn(regs,port) {
  turnPort(regs,port,true);
}
function turnPortOff(regs,port) {
  turnPort(regs,port,false);
}
app.get('/api/on/:port',function(req,res) {
  turnPortOn(registers,req.params.port);	
  res.json({err : null});
});

app.get('/api/off/:port',function(req,res) {
  turnPortOff(registers,req.params.port);
  res.json({err : null});
});

app.get('/api/toggle/:port',function(req,res) {
  var port = req.params.port;
  var addr = getAddressForPort(port);
  if(addr.err) {
    console.log(addr.err);
  } else {
    var val = getBit(registers[addr.module][addr.row],addr.port);
    val = !val;
    turnPort(registers,port,val);    
  }
  res.json({err : null});
});

app.get('/api/beep/:port',function(req,res) {
  var port = req.params.port;
  turnPortOn(registers,port);
  setTimeout(function() {
    turnPortOff(registers,port);
  },beepLength);
  res.json({err : null});
});

app.use(express.static(__dirname + '/assets'));

var server = app.listen(serverPort, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});

