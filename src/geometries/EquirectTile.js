/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

var inherits = require('../util/inherits');
var hash = require('../util/hash');
var cmp = require('../util/cmp');
var common = require('./common');
var Level = require('./Level');
var clamp = require('../util/clamp');
var mod = require('../util/mod');
var cmp = require('../util/cmp');
var type = require('../util/type');
var TileSearcher = require('../TileSearcher');
var LruMap = require('../collections/LruMap');
const registerDefaultRenderers = require('../renderers/registerDefaultRenderers');

var vec3 = require('gl-matrix').vec3;
var vec4 = require('gl-matrix').vec4;

var neighborsCacheSize = 64;


var neighborOffsets = [
    [0, 1], // top
    [1, 0], // right
    [0, -1], // bottom
    [-1, 0]  // left
];


/**
 * @class EquirectTile
 * @implements Tile
 * @classdesc
 *
 * A tile in an @{EquirectTileGeometry}.
 */
function EquirectTile(x, y, z, geometry) {
    this.x = x;
    this.y = y;
    this.z = z;
    this._geometry = geometry;
    this._level = geometry.levelList[z];
}


EquirectTile.prototype.rotX = function () {
    return 0;
};


EquirectTile.prototype.rotY = function () {
    return 0;
};

EquirectTile.prototype.minX = function () {
    var levelWidth = this._level.width();
    var tileWidth = this._level.tileWidth();
    return (this.x * tileWidth) / levelWidth;
};


EquirectTile.prototype.minY = function () {
    var levelHeight = this._level.height();
    var tileHeight = this._level.tileHeight();
    return (this.y * tileHeight) / levelHeight;
};


EquirectTile.prototype.scaleX = function () {
    var levelWidth = this._level.width();
    return this.width() / levelWidth;
};


EquirectTile.prototype.scaleY = function () {
    var levelHeight = this._level.height();
    return this.height() / levelHeight;
};


EquirectTile.prototype.width = function () {
    var levelWidth = this._level.width();
    var tileWidth = this._level.tileWidth();
    if (this.x === this._level.numHorizontalTiles() - 1) {
        var widthRemainder = mod(levelWidth, tileWidth);
        return widthRemainder || tileWidth;
    } else {
        return tileWidth;
    }
};


EquirectTile.prototype.height = function () {
    var levelHeight = this._level.height();
    var tileHeight = this._level.tileHeight();
    if (this.y === this._level.numVerticalTiles() - 1) {
        var heightRemainder = mod(levelHeight, tileHeight);
        return heightRemainder || tileHeight;
    } else {
        return tileHeight;
    }
};

EquirectTile.prototype.parent = function () {


    if (this.z === 0) {
        return null;
    }

    var geometry = this._geometry;

    var level = geometry.levelList[this.z];
    var parentLevel = geometry.levelList[this.z-1];

    var z = this.z - 1;
    // TODO: Currently assuming each level is double the size of previous one.
    // Fix to support other multiples.
    var x = Math.floor(this.x / (level.numHorizontalTiles() / parentLevel.numHorizontalTiles()));
    var y = Math.floor(this.y / (level.numVerticalTiles() / parentLevel.numVerticalTiles()));

    return new EquirectTile(x, y, z, geometry);

};

EquirectTile.prototype.children = function (result) {
    if (this.z === this._geometry.levelList.length - 1) {
        return null;
    }

    var geometry = this._geometry;
    var level = geometry.levelList[this.z];
    var childLevel = geometry.levelList[this.z+1];
    var z = this.z + 1;

    result = result || [];

    var xscale =  childLevel.numHorizontalTiles() / level.numHorizontalTiles();
    var yscale =  childLevel.numVerticalTiles() / level.numVerticalTiles();
    
    for (var x=0; x<xscale; x++)
    {
        for (var y=0; y<yscale; y++)
        {
        result.push(new EquirectTile(xscale * this.x + x, yscale * this.y + y, z, geometry));
        }
    }
    return result;
};


EquirectTile.prototype.vertices = function (result) {
    if (!result) {
        result = [vec3.create(), vec3.create(), vec3.create(), vec3.create()];
    }

    function makeVertex(vec, yaw, pitch) {
        var x = Math.sin(yaw) * Math.cos(pitch);
        var y = -Math.sin(pitch);
        var z = Math.cos(yaw) * Math.cos(pitch);
        vec3.set(vec, x, y, z);
    }

    var left = -(this.minX()) * Math.PI * 2;
    var right = left - this.scaleX() * Math.PI * 2;
    var bottom =-(this.minY() - 0.5) * Math.PI;
    var top = bottom - this.scaleY() * Math.PI;

    makeVertex(result[3], left, bottom);
    makeVertex(result[2], right, bottom);
    makeVertex(result[1], right, top);
    makeVertex(result[0], left, top);

    return result;
};

EquirectTile.prototype.neighbors = function () {

    var geometry = this._geometry;
    var cache = geometry._neighborsCache;

    // Satisfy from cache when available.
    var cachedResult = cache.get(this);
    if (cachedResult) {
        return cachedResult;
    }

    var x = this.x;
    var y = this.y;
    var z = this.z;
    var level = this._level;

    var numX = level.numHorizontalTiles() - 1;
    var numY = level.numVerticalTiles() - 1;

    var result = [];

    for (var i = 0; i < neighborOffsets.length; i++) {
        var xOffset = neighborOffsets[i][0];
        var yOffset = neighborOffsets[i][1];

        var newX = x + xOffset;
        var newY = y + yOffset;
        var newZ = z;

        if (newX < 0) newX = numX;
        if (newX > numX) newX = 0;


        if (0 <= newY && newY <= numY) {
            result.push(new EquirectTile(newX, newY, newZ, geometry));
        }
    }

    // Store into cache to satisfy future requests.
    cache.set(this, result);

    return result;

};


EquirectTile.prototype.hash = function () {
    return hash(this.z, this.x, this.y, this.z);
};


EquirectTile.prototype.equals = function (that) {
    return this._geometry === that._geometry && this.y === that.y && this.x === that.x && this.z === that.z;
};


EquirectTile.prototype.cmp = function (that) {
    return cmp(this.z, that.z);
};


EquirectTile.prototype.str = function () {
    return 'EquirectTile(' + tile.x + ',' + tile.y + ',' + tile.z + ')';
};


function EquirectTileLevel(levelProperties) {
    this.constructor.super_.call(this, levelProperties);
    this._width = levelProperties.width;
    this._height = levelProperties.height;
    this._tileWidth = levelProperties.tileWidth;
    this._tileHeight = levelProperties.tileHeight;
}

inherits(EquirectTileLevel, Level);


EquirectTileLevel.prototype.width = function () {
    return this._width;
};


EquirectTileLevel.prototype.height = function () {
    return this._height;
};


EquirectTileLevel.prototype.tileWidth = function () {
    return this._tileWidth;
};


EquirectTileLevel.prototype.tileHeight = function () {
    return this._tileHeight;
};


/**
 * @class EquirectTileGeometry
 * @implements Geometry
 * @classdesc
 *
 * A {@link Geometry} implementation suitable for equirectangular images with a
 * 2:1 aspect ratio.
 *
 * @param {Object[]} levelPropertiesList Level description
 * @param {number} levelPropertiesList[].width Level width in pixels
*/
function EquirectTileGeometry(levelPropertiesList) {
    if (type(levelPropertiesList) !== 'array') {
        throw new Error('Level list must be an array');
    }

    this.levelList = common.makeLevelList(levelPropertiesList, EquirectTileLevel);
    this.selectableLevelList = common.makeSelectableLevelList(this.levelList);

    for (var i = 1; i < this.levelList.length; i++) {
        this.levelList[i]._validateWithParentLevel(this.levelList[i - 1]);
    }

    this._tileSearcher = new TileSearcher(this);

    this._neighborsCache = new LruMap(neighborsCacheSize);

    this._vec = vec4.create();

    this._viewSize = {};
}


EquirectTileLevel.prototype._validateWithParentLevel = function (parentLevel) {

    var width = this.width();
    var height = this.height();
    var tileWidth = this.tileWidth();
    var tileHeight = this.tileHeight();

    var parentWidth = parentLevel.width();
    var parentHeight = parentLevel.height();
    var parentTileWidth = parentLevel.tileWidth();
    var parentTileHeight = parentLevel.tileHeight();

    if (width % parentWidth !== 0) {
        return new Error('Level width must be multiple of parent level: ' +
            width + ' vs. ' + parentWidth);
    }

    if (height % parentHeight !== 0) {
        return new Error('Level height must be multiple of parent level: ' +
            height + ' vs. ' + parentHeight);
    }

    if (tileWidth % parentTileWidth !== 0) {
        return new Error('Level tile width must be multiple of parent level: ' +
            tileWidth + ' vs. ' + parentTileWidth);
    }

    if (tileHeight % parentTileHeight !== 0) {
        return new Error('Level tile height must be multiple of parent level: ' +
            tileHeight + ' vs. ' + parentTileHeight);
    }

};


EquirectTileGeometry.prototype.maxTileSize = function () {
    var maxTileSize = 0;
    for (var i = 0; i < this.levelList.length; i++) {
        var level = this.levelList[i];
        maxTileSize = Math.max(maxTileSize, level.tileWidth, level.tileHeight);
    }
    return maxTileSize;
};


EquirectTileGeometry.prototype.levelTiles = function (level, result) {
    var levelIndex = this.levelList.indexOf(level);
    var maxX = level.numHorizontalTiles() - 1;
    var maxY = level.numVerticalTiles() - 1;

    if (!result) {
        result = [];
    }

    for (var x = 0; x <= maxX; x++) {
        for (var y = 0; y <= maxY; y++) {
            result.push(new EquirectTile(x, y, levelIndex, this));
        }
    }

    return result;
};


EquirectTileGeometry.prototype.visibleTiles = function (view, level, result) {

    var viewSize = this._viewSize;
    var tileSearcher = this._tileSearcher;

    result = result || [];

    view.size(viewSize);
    if (viewSize.width === 0 || viewSize.height === 0) {
        // No tiles are visible if the viewport is empty.
        return result;
    }

    var startingTile = this._closestTile(view, level);
    console.log(startingTile)
    var count = tileSearcher.search(view, startingTile, result);
    if (!count) {
        console.log(startingTile)
        console.log(view);
        console.log(startingTile.vertices())
        throw new Error('Starting tile is not visible');
    }
     //result.length=0;
   //  result[0]=startingTile;
    return result;
}


EquirectTileGeometry.prototype._closestTile = function (view, level) {
    var ray = this._vec;

    // Compute the image coordinates that the view ray points into.
    var x =  view.yaw()  / (2 * Math.PI)  + 0.5;
    var y =  -view.pitch() / Math.PI + 0.5

    // Get the desired zoom level.
    var tileZ = this.levelList.indexOf(level);
    var levelWidth = level.width();
    var levelHeight = level.height();
    var tileWidth = level.tileWidth();
    var tileHeight = level.tileHeight();
    var numX = level.numHorizontalTiles();
    var numY = level.numVerticalTiles();

    // Find the coordinates of the tile that the view ray points into.
    var tileX = mod(Math.floor(x * levelWidth / tileWidth), numX);
    var tileY = clamp(Math.floor(y * levelHeight / tileHeight), 0, numY - 1);

    return new EquirectTile(tileX, tileY, tileZ, this);
};


EquirectTileGeometry.Tile = EquirectTileGeometry.prototype.Tile = EquirectTile;
EquirectTileGeometry.type = EquirectTileGeometry.prototype.type = 'equirecttiled';
EquirectTile.type = EquirectTile.prototype.type = 'equirecttiled';


module.exports = EquirectTileGeometry;
