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

// Create viewer.
var viewer = new Marzipano.Viewer(document.getElementById('pano'));

// The tiles were generated with the krpano tools, which index the tiles
// from 1 instead of 0. Hence, we cannot use ImageUrlSource.fromString()
// and must write a custom function to convert tiles into URLs.
var urlPrefix = "https://video.gaist.co.uk/video/image?workspace=Blackpool/2022&trace=62a0ac16fea0023f7184956e&camera=360e&frame=10&cleft={cleft}&ctop={ctop}&cwidth={cwidth}&cheight={cheight}&width={width}";
var tileUrl = function(tile) {
    console.log(tile,tile.minX(),tile.minY(),tile.scaleX(),tile.scaleY(),tile.width(), tile.height())
  return urlPrefix
  .replace('{cleft}', tile.minX() * 8192)
  .replace('{ctop}', (1-tile.minY()-tile.scaleY())*4096)
  .replace('{cwidth}', tile.scaleX()*8192)
  .replace('{cheight}', tile.scaleY()*4096)
  .replace('{width}', tile.width())
  + ((tile.width() == tile.scaleX()*8192) ? '&quality=92' : '&quality=85')

  ;
};
var source = new Marzipano.ImageUrlSource(function(tile) {
  return { url: tileUrl(tile) };
});

// Create procedurally-generated single-color tile source.
source = new SolidColorSource(512   , 512);
// Create geometry.
var geometry = new Marzipano.EquirectTileGeometry([
    { width: 1024,  height: 512,   tileWidth: 1024, tileHeight: 512, fallback: true },
    { width: 4096,  height: 2048,  tileWidth: 512, tileHeight: 512 },
    { width: 8192,  height: 4096,  tileWidth: 512, tileHeight: 512 },
]);

// Create view.
// The letterbox view limiter allows the view to zoom out until the image is
// fully visible, adding black bands around the image where necessary.
var limiter = Marzipano.RectilinearView.limit.traditional(8192, 100*Math.PI/180);
var view = new Marzipano.RectilinearView({ yaw: Math.PI }, limiter);

// Create scene.
var scene = viewer.createScene({
  source: source,
  geometry: geometry,
  view: view,
  pinFirstLevel: false
});

// Display scene.
scene.switchTo();
