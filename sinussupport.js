'use strict';
/*
Copyright (C) pproj 

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/

var errordiv = document.getElementById('noconn');
errordiv.style.display = 'none';
var errordiv = document.getElementById('gui');
errordiv.style.display = 'block';
(function() {
    'use strict';
    var textFile = null,
        makeTextFile = function(text) {
            var data = new Blob([text], {
                type: 'text/plain'
            });

            // If we are replacing a previously generated file we need to
            // manually revoke the object URL to avoid memory leaks.
            if (textFile !== null) {
                window.URL.revokeObjectURL(textFile);
            }

            textFile = window.URL.createObjectURL(data);

            return textFile;
        };


    var create = document.getElementById('create');

    //var textbox = document.getElementById('textbox');

    create.addEventListener('click', function() {
        var link = document.getElementById('downloadlink');
        link.style.display = 'none';
        var resultPath = ImportSvgAndCreateSupportPath();

        link.href = makeTextFile(resultPath);
        link.style.display = 'block';
    }, false);
})();


function ImportSvgAndCreateSupportPath() {
    'use strict';

    var canvasElement = document.getElementById('canv');
    var canvasContext = canvasElement.getContext('2d');
    canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasContext.fillStyle = '#f00';

    var supportSettings = {
        xPeriodLen: parseFloat(document.getElementById('xPeriodLen').value),
        yAmplitude: parseFloat(document.getElementById('yAmplitude').value),
        lineThick: parseFloat(document.getElementById('lineThick').value),
        lineYMargin: parseFloat(document.getElementById('lineYMargin').value),
        stepsPerPeriod: parseFloat(document.getElementById('stepsPerPeriod').value),
        curveInterpolationSteps: parseFloat(document.getElementById('curveInterpolationSteps').value),
        svgInputFile: document.getElementById('svgInputFile').value,
    };

    //var svgInputFile="SinusSupport-FromStl.svg";//"sensorholder.svg";
    var part = importSvg(supportSettings.svgInputFile);

    plotShells(part.shellMetas, part.partBounds, canvasContext);

    var sortedShellMetas = orderShellMetas(part.shellMetas)
    part.partBounds.Plot(canvasContext);

    //console.log("------------end------");
    printShellMetas(part.shellMetas);

    //--------------- plotSinus  ----------------

    var supportPath = plotSinus(canvasContext, part.partBounds, sortedShellMetas, supportSettings);

    var resultPath = createScadTextFrom(supportPath, /*flipXy=*/ true);
    return resultPath;
}



function createScadTextFrom(supportPath, flipXy = false) {


    var resultPath = ""; // "pathLen=" + supportPath.length / 2 + ";\n";

    resultPath += "supportPath=[";

    for (var i = 0; i < supportPath.length; i++) {
        if (i % 2 == 0) resultPath += "[" + supportPath[i];
        else {
            resultPath += "," + ((flipXy ? -1 : 1) * supportPath[i]) + "]";
            if (i != supportPath.length - 1) resultPath += ",";
        }
    }
    resultPath += "];";

    return resultPath;
}

function FileHelper() {} {
    FileHelper.readStringFromFileAtPath = function(pathOfFileToReadFrom) {
        var request = new XMLHttpRequest();
        request.open("GET", pathOfFileToReadFrom, false);
        request.send(null);
        var returnValue = request.responseText;

        return returnValue;
    }
}


function plotSinus(canvasContext, partBounds, sortedShellMetas, supportSettings) {
    'use strict';
    var xSize = partBounds.maxXy[0] - partBounds.minXy[0];

    var xPeriodLen = supportSettings.xPeriodLen; //.6;
    var yAmplitude = supportSettings.yAmplitude; //6;
    var lineThick = supportSettings.lineThick; //.6;
    var lineYMargin = supportSettings.lineYMargin; //.1;

    var xStep = xPeriodLen / supportSettings.stepsPerPeriod; //15;
    var interPolationSteps = supportSettings.curveInterpolationSteps; //3;


    var pathOpen = false;
    var wasfillContents = false;
    var direction = 1;

    var supportPath = [];


    for (var yMin = partBounds.minXy[1] + lineThick / 2; yMin < partBounds.maxXy[1]; yMin += yAmplitude + lineThick / 2 + lineYMargin, direction *= -1) {
        var yMax = yMin + yAmplitude;
        for (var xRaw = 0; xRaw < xSize; xRaw += xStep) {
            'use strict';
            var yHalfAmp = (yMax - yMin) / 2;
            var xy = getXY(direction, xRaw, xSize, yMin, yHalfAmp, xPeriodLen);
            var x = xy[0] + partBounds.minXy[0];
            var y = xy[1];

            var fillContents = checkIfInside([x, y], sortedShellMetas);
            if (fillContents) {
                if (!wasfillContents && supportPath.length > 0) {

                    var oneBehindTargetPoint = getXY(direction, xRaw + xStep, xSize, yMin, yHalfAmp, xPeriodLen);
                    oneBehindTargetPoint.x += partBounds.minXy[0];
                    var lastIndex = supportPath.length - 1;
                    var curvePoints = closeIn([supportPath[lastIndex - 3], supportPath[lastIndex - 2]], [supportPath[lastIndex - 1], supportPath[lastIndex]], [x, y], oneBehindTargetPoint, interPolationSteps)

                    for (var t = 0; t < 4; t++) supportPath.pop();
                    for (var cp = 0; cp < curvePoints.length; cp += 2) {
                        var coords = partBounds.getCanvasCoords(curvePoints[cp], curvePoints[cp + 1]);
                        canvasContext.lineTo(coords[0], coords[1]);
                        supportPath.push(curvePoints[cp]);
                        supportPath.push(curvePoints[cp + 1]);
                    }

                } else {
                    if (!pathOpen) {
                        canvasContext.beginPath();
                        supportPath.push(x);
                        supportPath.push(y);
                        var coords = partBounds.getCanvasCoords(x, y);

                        canvasContext.moveTo(coords[0], coords[1]);
                        pathOpen = true;
                    } else {
                        supportPath.push(x);
                        supportPath.push(y);

                        var coords = partBounds.getCanvasCoords(x, y);
                        canvasContext.lineTo(coords[0], coords[1]);
                    }
                }
            }
            wasfillContents = fillContents;
        }


    }
    if (pathOpen) {
        // canvasContext.closePath();
        canvasContext.lineWidth = lineThick;
        canvasContext.strokeStyle = fillContents ? 'red' : 'blue';
        canvasContext.stroke();
        pathOpen = false;
    }

    return supportPath;
}
//--------------------------------------------------------------
function plotShells(shellMetas, partBounds, canvasContext) {
    shellMetas.forEach(function(shellMeta) {
        var poly = shellMeta.shellPolygon;
        //console.dir(poly);
        for (var i = 0; i < poly.length; i++) {
            var coords = partBounds.getCanvasCoords(poly[i][0], poly[i][1]);

            if (i == 0) {
                canvasContext.beginPath();
                canvasContext.moveTo(coords[0], coords[1]);
            } else canvasContext.lineTo(coords[0], coords[1]);
        }
        canvasContext.closePath();
        canvasContext.lineWidth = 2;
        canvasContext.strokeStyle = 'orange';
        canvasContext.stroke();
    });
}
//--------------------------------------------------------------------------------------------------------------
function BoundsType(canvasXSize = 600) {
    'use strict';
    this.maxXy = [-9999999999, -9999999999];
    this.minXy = [9999999999, 9999999999];
    this.size; // = [ maxXy[0]-minXy[0],maxXy[1]-minXy[1]];
    this.translation; //= [10-minXy[0],10-minXy[1]];
    this.scale; // =canvasXSize/Math.abs(size[0]>size[1]?size[0]:size[1]);
    this._canvasXSize = canvasXSize;
    this._pointsCount = 0;


    this.adjustBounds = function(coords) // minXyBounds: [x,y] ,maxXyBounds :[x,y]        
        {
            'use strict';
            this.size = null;
            ++this._pointsCount;
            for (var xyIndex = 0; xyIndex < 2; xyIndex++) {
                var val = coords[xyIndex];
                if (val < this.minXy[xyIndex]) {
                    this.minXy[xyIndex] = val;
                }
                if (val > this.maxXy[xyIndex]) {
                    this.maxXy[xyIndex] = val;
                }
            }
        }
    this.updateScaleIfNeeded = function() {
        if (!this.size) {
            this.size = [this.maxXy[0] - this.minXy[0], this.maxXy[1] - this.minXy[1]];
            this.translation = [10 - this.minXy[0], 10 - this.minXy[1]];
            this.scale = this._canvasXSize / Math.abs(this.size[0] > this.size[1] ? this.size[0] : this.size[1]);
        }
    }
    this.getCanvasCoords = function(x, y) {
        this.updateScaleIfNeeded();
        var coords = [x, y]; //*scale+translation;

        coords[0] += this.translation[0];
        coords[1] += this.translation[1];
        coords[0] *= this.scale;
        coords[1] *= this.scale;
        return coords;
    }
    this.Plot = function(canvasConext) {
        'use strict';

        this.updateScaleIfNeeded();
        var canvasContext = canvasConext;
        var visualBounds = {
            minXy: this.getCanvasCoords(this.minXy[0], this.minXy[1]),
            maxXy: this.getCanvasCoords(this.maxXy[0], this.maxXy[1])
        };

        canvasContext.beginPath();
        canvasContext.moveTo(visualBounds.minXy[0], visualBounds.minXy[1]);
        canvasContext.lineTo(visualBounds.maxXy[0], visualBounds.minXy[1]);
        canvasContext.lineTo(visualBounds.maxXy[0], visualBounds.maxXy[1]);
        canvasContext.lineTo(visualBounds.minXy[0], visualBounds.maxXy[1]);
        canvasContext.closePath();
        canvasContext.lineWidth = 2;
        canvasContext.strokeStyle = 'brown';
        canvasContext.stroke();
    }


}

function printShellMetas(shellMetas) {
    shellMetas.forEach(function(m) console.log(!m ? "shell NULL" : ("shellId: " + m.shellId + "(fill=" + m.fillContents + ")->" + m.containsShells.map(function(m) !m ? "null" : m.shellId))));
}

function importSvg(svgInputFile) {
    'use strict';
    var parser = new DOMParser();
    var doc = parser.parseFromString(FileHelper.readStringFromFileAtPath(svgInputFile), "image/svg+xml");

    var pathSvg = doc.activeElement.childNodes[3].pathSegList;



    var allShells = [];
    var shellMetas = [];

    var curPolygon = [];
    var curPolygonMeta = {};
    var partBounds = new BoundsType(600);

    for (var item = 0; item < pathSvg.length; item++) {
        'use strict';
        var pathNode = pathSvg[item];

        if (pathNode.pathSegType == 1) //code="z")
        {
            curPolygon.push(curPolygon[0]); //close the polygon legs
            allShells.push(curPolygon);

            curPolygonMeta.shellPolygon = curPolygon;
            shellMetas.push(curPolygonMeta)
        } else {
            var coords = [pathNode.x, pathNode.y];

            if (pathNode.pathSegType == 2) //"M")
            {
                curPolygon = [];
                curPolygon.push(coords);
                partBounds.adjustBounds(coords);
                curPolygonMeta = {
                    shellId: allShells.length,

                    isOuterShell: false,
                    fillContents: false,
                    containsShells: []
                };

            } else if (pathNode.pathSegType == 4) //"L")
            {
                curPolygon.push(coords);
                partBounds.adjustBounds(coords);
            }
        }


    }
    return {
        shellMetas: shellMetas,
        partBounds: partBounds
    }
}

function orderShellMetas(shellMetas) {
    'use strict';
    for (var i = 0; i < shellMetas.length; i++) {
        var allShells = shellMetas.map(function(sm) sm.shellPolygon);
        var m = shellMetas[i];
        m.isInsideOf = [];
        for (var of = 0; of < shellMetas.length; of++) {
            if (insidePoly(m.shellPolygon[0], allShells[of])) {
                m.isInsideOf.push(of);
                if (of != m.shellId && !shellMetas[of].containsShells.filter(function(e) {
                        return e.shellId == m.shellId;
                    }).length > 0)
                    shellMetas[of].containsShells.push(m);
            }
        }
        if (m.isInsideOf.length == 0) m.isOuterShell = true;
    }

    var outerShells = shellMetas.filter(function(e) {
        return e.isOuterShell;
    });
    outerShells.forEach(function scanContained(shellMeta) {
        //console.log("-----------Scanning Shell:" + shellMeta.shellId);
        for (i = 0; i < shellMeta.containsShells.length; i++) {

            var shelltoAvoid = shellMeta.containsShells[i];
            if (shelltoAvoid) {
                shellMeta.containsShells[i] = null; //hide the first reference to shelltoAvoid
                var depthCheckFunc = thisAndContaindedAreNotFunctionFactoryFor(shelltoAvoid)
                if (shellMeta.containsShells.every(depthCheckFunc, shelltoAvoid)) {
                    shellMeta.containsShells[i] = shelltoAvoid; //if no other way to it, restore the reference
                    //	console.log("retoring:"+ shelltoAvoid.shellId +" at position"+ i);
                }
            }
        }
        shellMeta.containsShells = shellMeta.containsShells.filter(function(s) !(!s));

        if (shellMeta.isOuterShell) shellMeta.fillContents = true;
        shellMeta.containsShells.forEach(function(s) s.fillContents = !shellMeta.fillContents);
        shellMeta.containsShells.filter(function(s) s.containsShells.length > 0).forEach(scanContained);

    });

    var sortedShellMetas = [];
    outerShells.forEach(function(shell) sortDeep(shell, sortedShellMetas));
    sortedShellMetas = sortedShellMetas.reverse();
    return sortedShellMetas;
}



function thisAndContaindedAreNotFunctionFactoryFor(shellToAvoid) {


    return function depthCheck(shellMeta, index, lookingIn) {
        'use strict';
        var m = shellMeta;

        if (!shellMeta) return true;
        if (shellMeta.shellId == shellToAvoid.shellId) return false;
        return shellMeta.containsShells.every(depthCheck, shellToAvoid);
    };
}


function sortDeep(shellMeta, sortedShellMetas) {
    sortedShellMetas.push(shellMeta);
    var contains = shellMeta.containsShells;
    //if(!contains)return;
    for (var i = 0; i < contains.length; i++)
        sortDeep(contains[i], sortedShellMetas);
}

function checkIfInside(coords, sortedShellMetas) {

    for (var si = 0; si < sortedShellMetas.length; si++) {
        if (insidePoly(coords, sortedShellMetas[si].shellPolygon)) {
            return sortedShellMetas[si].fillContents;

        }
    }
    return false;
}

function insidePoly(point, vs) {
    //taken from 'point-in-polygon');
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

    var x = point[0],
        y = point[1];

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0],
            yi = vs[i][1];
        var xj = vs[j][0],
            yj = vs[j][1];

        var intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};


function getXY(direction, xRaw, xSize, yMin, yHalfAmp, xPeriodLen) {
    'use strict';
    var x = direction > 0 ? xRaw : xSize - xRaw;
    var y = yMin + yHalfAmp + Math.sin((direction > 0 ? Math.PI : 0) + 2 * Math.PI * x / xPeriodLen) * yHalfAmp;
    return [x, y];
}



function makeAzimuth(pointStart, pointEnd) {
    var azi = [pointEnd[0] - pointStart[0], pointEnd[1] - pointStart[1]];
    var aziScale = Math.sqrt(azi[0] * azi[0] + azi[1] * azi[1]);
    azi = [azi[0] / aziScale, azi[1] / aziScale];
    return azi;
}

function closeIn(oneBeforeLeavingPoint, leavingPoint, targetPoint, oneBehindTargetPoint, interPolationSteps) {
    'use strict';

    var lastAzimuth = makeAzimuth(oneBeforeLeavingPoint, leavingPoint);
    var closingVector = lastAzimuth;
    var closingPoint = leavingPoint;
    var curvePoints = [];

    var antiLastAzimuth = makeAzimuth(oneBehindTargetPoint, targetPoint);
    var antiClosingVector = antiLastAzimuth;
    var antiClosingPoint = targetPoint;
    var antiCurvePoints = [];

    for (var interStep = 0; interStep < interPolationSteps; interStep++) {
        var azimuth = makeAzimuth(closingPoint, antiClosingPoint);

        closingVector = [(lastAzimuth[0] * (interPolationSteps - 1 - interStep) + azimuth[0] * interStep) / interPolationSteps,
            (lastAzimuth[1] * (interPolationSteps - 1 - interStep) + azimuth[1] * interStep) / interPolationSteps
        ];
        closingPoint[0] += closingVector[0];
        closingPoint[1] += closingVector[1];
        curvePoints.push(closingPoint[0]);
        curvePoints.push(closingPoint[1]);

        var antiAzimuth = makeAzimuth(antiClosingPoint, closingPoint);
        antiClosingVector = [(antiLastAzimuth[0] * (interPolationSteps - 1 - interStep) + antiAzimuth[0] * interStep) / interPolationSteps,
            (antiLastAzimuth[1] * (interPolationSteps - 1 - interStep) + antiAzimuth[1] * interStep) / interPolationSteps
        ];
        antiClosingPoint[0] += antiClosingVector[0];
        antiClosingPoint[1] += antiClosingVector[1];
        antiCurvePoints.push(antiClosingPoint[1]); //reversed x,y order for anti !!!!
        antiCurvePoints.push(antiClosingPoint[0]);
    }
    return curvePoints.concat(antiCurvePoints.reverse());
}