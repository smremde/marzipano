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

var assert = require('chai').assert;

var EquirectTileGeometry = require('../../../src/geometries/EquirectTile');
var EquirectTile = EquirectTileGeometry.Tile;

suite('EquirectTileGeometry', function() {

  function containsTile(tileList, tile) {
    for (var i = 0; i < tileList.length; i++) {
      if (tileList[i].equals(tile)) {
        return true;
      }
    }
    return false;
  }

  suite('malformed levels', function() {

    test('level size must not be smaller than parent level', function() {
      assert.throws(function() {
        new Equirect([{ tileSize: 512, size: 512 }, { tileSize: 512, size: 500 }]);
      });
    });

    test('level size must be multiple of parent level', function() {
      assert.throws(function() {
        new Equirect([{ tileSize: 512, size: 512 }, { tileSize: 512, size: 1000 }]);
      });
    });

    test('number of tiles in level must not be smaller than parent level', function() {
      assert.throws(function() {
        new Equirect([{ tileSize: 128, size: 512 }, { tileSize: 512, size: 1024 }]);
      });
    });

    test('number of tiles in level must be multiple of parent level', function() {
      assert.throws(function() {
        new Equirect([{ tileSize: 256, size: 512 }, { tileSize: 512, size: 512*3 }]);
      });
    });

  });

  suite('levels with constant tile size', function() {

    var Equirect = null;

    setup(function() {
      var levels = [
        { tileWidth: 512, width: 512, tileHeight: 512, height: 512 },
        { tileWidth: 512, width: 1024, tileHeight: 512, height: 1024 },
        { tileWidth: 512, width: 2048, tileHeight: 512, height: 2048 }
      ];
      Equirect = new EquirectTileGeometry(levels);
    });

    test('top tile does not have parent', function() {
      var p = new EquirectTile(0, 0, 0, Equirect).parent();
      assert.isNull(p);
    });

    test('parent of level 1', function() {
      for (var tileX = 0; tileX < 2; tileX++) {
        for (var tileY = 0; tileY < 2; tileY++) {
          var p = new EquirectTile(tileX, tileY, 1, Equirect).parent();
          assert.isTrue(p.equals(new EquirectTile(0, 0, 0, Equirect)));
        }
      }
    });

    test('parent of level 2', function() {
      var p = new EquirectTile(2, 0, 2, Equirect).parent();
      assert.isTrue(p.equals(new EquirectTile(1, 0, 1, Equirect)));
    });

    test('children of level 0', function() {
      var c = new EquirectTile(0, 0, 0, Equirect).children();
      assert.lengthOf(c, 4);
      assert.isTrue(containsTile(c, new EquirectTile(0, 0, 1, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(0, 1, 1, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(1, 0, 1, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(1, 1, 1, Equirect)));
    });

    test('children of level 1 top right', function() {
      var c = new EquirectTile(1, 0, 1, Equirect).children();
      assert.lengthOf(c, 4);
      assert.isTrue(containsTile(c, new EquirectTile(2, 0, 2, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(2, 1, 2, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(3, 0, 2, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(3, 1, 2, Equirect)));
    });
  });

  suite('levels with doubling tile size', function() {

    var Equirect = null;

    setup(function() {
      var levels = [
        { tileWidth: 256, width: 512, tileHeight: 256, height: 512 },
        { tileWidth: 512, width: 1024, tileHeight: 512, height: 1024 }
      ];
      Equirect = new EquirectTileGeometry(levels);
    });

    test('parent top left tile', function() {
      var p = new EquirectTile(0, 0, 1, Equirect).parent();
      assert.isTrue(p.equals(new EquirectTile(0, 0, 0, Equirect)));
    });

    test('parent top right tile', function() {
      var p = new EquirectTile(1, 0, 1, Equirect).parent();
      assert.isTrue(p.equals(new EquirectTile(1, 0, 0, Equirect)));
    });

    test('children of level 0 top right', function() {
      var c = new EquirectTile(1, 0, 0, Equirect).children();
      assert.lengthOf(c, 1);
      assert.isTrue(containsTile(c, new EquirectTile(1, 0, 1, Equirect)));
    });
  });

  suite('levels with halving tile size', function() {

    var Equirect = null;

    setup(function() {
      var levels = [
        { tileWidth: 128, width: 256, tileHeight: 128, height: 256 },
        { tileWidth: 64, width: 512, tileHeight: 64, height: 512 }
      ];
      Equirect = new EquirectTileGeometry(levels);
    });

    test('parent of top left tile', function() {
      var p = new EquirectTile(0, 0, 1, Equirect).parent();
      assert.isTrue(p.equals(new EquirectTile(0, 0, 0, Equirect)));
    });

    test('parent of top right tile', function() {
      var p = new EquirectTile(7, 0, 1, Equirect).parent();
      assert.isTrue(p.equals(new EquirectTile(1, 0, 0, Equirect)));
    });

    test('children of level 0 top right', function() {
      var c = new EquirectTile(1, 0, 0, Equirect).children();
      assert.lengthOf(c, 16);
      assert.isTrue(containsTile(c, new EquirectTile(4, 0, 1, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(7, 0, 1, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(4, 3, 1, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(7, 3, 1, Equirect)));
    });
  });

  suite('levels with tripling tile size', function() {

    var Equirect = null;

    setup(function() {
      var levels = [
        { tileWidth: 256, width: 512, tileHeight: 256, height: 512 },
        { tileWidth: 256, width: 1536, tileHeight: 256, height: 1536 }
      ];
      Equirect = new EquirectTileGeometry(levels);
    });

    test('top right tile parent', function() {
      var p = new EquirectTile(4, 2, 1, Equirect).parent();
      assert.isTrue(p.equals(new EquirectTile(1, 0, 0, Equirect)));
    });

    test('top right tile children', function() {
      var c = new EquirectTile(1, 0, 0, Equirect).children();
      assert.lengthOf(c, 9);
      assert.isTrue(containsTile(c, new EquirectTile(3, 0, 1, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(5, 0, 1, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(3, 2, 1, Equirect)));
      assert.isTrue(containsTile(c, new EquirectTile(5, 2, 1, Equirect)));
    });

  });

});
