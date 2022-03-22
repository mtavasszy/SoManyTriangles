"use strict";

// program variables //
var TARGET_IMAGE = new Image();
var IMAGE_W = 0;
var IMAGE_H = 0;

var CANVAS_W = 300;
var CANVAS_H = 300;

var CANVAS_TARGET = 0;
var GL_TARGET = 0;
var CANVAS_BEST = 0;
var GL_BEST = 0;
// // 

window.addEventListener('load', function () {
  document.querySelector('#upload_target_image').addEventListener('change', function () {
    if (this.files && this.files[0]) {
      TARGET_IMAGE.onload = () => {
        URL.revokeObjectURL(TARGET_IMAGE.src);  // no longer needed, free memory
        updateCanvas();
        renderTargetImage();
        renderBestImage();
      }

      TARGET_IMAGE.src = URL.createObjectURL(this.files[0]); // set src to blob url
    }
  });
});

function updateCanvas() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  CANVAS_TARGET = document.querySelector("#canvas_target");
  GL_TARGET = CANVAS_TARGET.getContext("webgl2");
  if (!GL_TARGET) {
    return;
  }

  IMAGE_W = TARGET_IMAGE.width;
  IMAGE_H = TARGET_IMAGE.height;

  CANVAS_TARGET.width = IMAGE_W;
  CANVAS_TARGET.height = IMAGE_H;

  CANVAS_BEST = document.querySelector("#canvas_best");
  CANVAS_BEST.width = IMAGE_W;
  CANVAS_BEST.height = IMAGE_H;
}

function renderTargetImage() {
  // setup GLSL program
  var program = webglUtils.createProgramFromSources(GL_TARGET,
    [imageVertexShaderSource, imageFragmentShaderSource]);

  // look up where the vertex data needs to go.
  var positionAttributeLocation = GL_TARGET.getAttribLocation(program, "a_position");
  var texCoordAttributeLocation = GL_TARGET.getAttribLocation(program, "a_texCoord");

  // lookup uniforms
  var resolutionLocation = GL_TARGET.getUniformLocation(program, "u_resolution");
  var imageLocation = GL_TARGET.getUniformLocation(program, "u_image");

  // Create a vertex array object (attribute state)
  var vao = GL_TARGET.createVertexArray();

  // and make it the one we're currently working with
  GL_TARGET.bindVertexArray(vao);

  // Create a buffer and put a single pixel space rectangle in
  // it (2 triangles)
  var positionBuffer = GL_TARGET.createBuffer();

  // Turn on the attribute
  GL_TARGET.enableVertexAttribArray(positionAttributeLocation);

  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  GL_TARGET.bindBuffer(GL_TARGET.ARRAY_BUFFER, positionBuffer);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  var size = 2;          // 2 components per iteration
  var type = GL_TARGET.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  GL_TARGET.vertexAttribPointer(
    positionAttributeLocation, size, type, normalize, stride, offset);

  // provide texture coordinates for the rectangle.
  var texCoordBuffer = GL_TARGET.createBuffer();
  GL_TARGET.bindBuffer(GL_TARGET.ARRAY_BUFFER, texCoordBuffer);
  GL_TARGET.bufferData(GL_TARGET.ARRAY_BUFFER, new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    0.0, 1.0,
    0.0, 1.0,
    1.0, 0.0,
    1.0, 1.0,
  ]), GL_TARGET.STATIC_DRAW);

  // Turn on the attribute
  GL_TARGET.enableVertexAttribArray(texCoordAttributeLocation);

  // Tell the attribute how to get data out of texCoordBuffer (ARRAY_BUFFER)
  var size = 2;          // 2 components per iteration
  var type = GL_TARGET.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  GL_TARGET.vertexAttribPointer(
    texCoordAttributeLocation, size, type, normalize, stride, offset);

  // Create a texture.
  var texture = GL_TARGET.createTexture();

  // make unit 0 the active texture uint
  // (ie, the unit all other texture commands will affect
  GL_TARGET.activeTexture(GL_TARGET.TEXTURE0 + 0);

  // Bind it to texture unit 0' 2D bind point
  GL_TARGET.bindTexture(GL_TARGET.TEXTURE_2D, texture);

  // Set the parameters so we don't need mips and so we're not filtering
  // and we don't repeat at the edges
  GL_TARGET.texParameteri(GL_TARGET.TEXTURE_2D, GL_TARGET.TEXTURE_WRAP_S, GL_TARGET.CLAMP_TO_EDGE);
  GL_TARGET.texParameteri(GL_TARGET.TEXTURE_2D, GL_TARGET.TEXTURE_WRAP_T, GL_TARGET.CLAMP_TO_EDGE);
  GL_TARGET.texParameteri(GL_TARGET.TEXTURE_2D, GL_TARGET.TEXTURE_MIN_FILTER, GL_TARGET.NEAREST);
  GL_TARGET.texParameteri(GL_TARGET.TEXTURE_2D, GL_TARGET.TEXTURE_MAG_FILTER, GL_TARGET.NEAREST);

  // Upload the image into the texture.
  var mipLevel = 0;               // the largest mip
  var internalFormat = GL_TARGET.RGBA;   // format we want in the texture
  var srcFormat = GL_TARGET.RGBA;        // format of data we are supplying
  var srcType = GL_TARGET.UNSIGNED_BYTE; // type of data we are supplying
  GL_TARGET.texImage2D(GL_TARGET.TEXTURE_2D,
    mipLevel,
    internalFormat,
    srcFormat,
    srcType,
    TARGET_IMAGE);

  // Tell WebGL how to convert from clip space to pixels
  GL_TARGET.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Clear the canvas
  GL_TARGET.clearColor(0, 0, 0, 0);
  GL_TARGET.clear(GL_TARGET.COLOR_BUFFER_BIT | GL_TARGET.DEPTH_BUFFER_BIT);

  // Tell it to use our program (pair of shaders)
  GL_TARGET.useProgram(program);

  // Bind the attribute/buffer set we want.
  GL_TARGET.bindVertexArray(vao);

  // Pass in the canvas resolution so we can convert from
  // pixels to clipspace in the shader
  GL_TARGET.uniform2f(resolutionLocation, IMAGE_W, IMAGE_H);

  // Tell the shader to get the texture from texture unit 0
  GL_TARGET.uniform1i(imageLocation, 0);

  // Bind the position buffer so GL_TARGET.bufferData that will be called
  // in setRectangle puts data in the position buffer
  GL_TARGET.bindBuffer(GL_TARGET.ARRAY_BUFFER, positionBuffer);

  // Set a rectangle the same size as the image.
  setRectangle(GL_TARGET, 0, 0, IMAGE_W, IMAGE_H);

  // Draw the rectangle.
  var primitiveType = GL_TARGET.TRIANGLES;
  var offset = 0;
  var count = 6;
  GL_TARGET.drawArrays(primitiveType, offset, count);
}

function renderBestImage() {
  // Get A WebGL context
  var CANVAS_BEST = document.querySelector("#canvas_best");
  var GL_BEST = CANVAS_BEST.getContext("webgl2");
  if (!GL_BEST) {
    return;
  }

  // Use our boilerplate utils to compile the shaders and link into a program
  var program = webglUtils.createProgramFromSources(GL_BEST, [triangleVertexShaderSource, triangleFragmentShaderSource]);

  // look up where the vertex data needs to go.
  var positionAttributeLocation = GL_BEST.getAttribLocation(program, "a_position");
  var colorAttributeLocation = GL_BEST.getAttribLocation(program, "a_color");

  // look up uniform locations
  var resolutionUniformLocation = GL_BEST.getUniformLocation(program, "u_resolution");

  // Create set of attributes
  var vao = GL_BEST.createVertexArray();
  GL_BEST.bindVertexArray(vao);

  // Create a buffer for the positons.
  var buffer = GL_BEST.createBuffer();
  GL_BEST.bindBuffer(GL_BEST.ARRAY_BUFFER, buffer);

  // Set Geometry.
  GL_BEST.bufferData(
    GL_BEST.ARRAY_BUFFER,
    new Float32Array([
      100, 200,
      500, 200,
      100, 300,
      100, 300,
      500, 200,
      500, 300,
    ]),
    GL_BEST.STATIC_DRAW);

  // tell the position attribute how to pull data out of the current ARRAY_BUFFER
  GL_BEST.enableVertexAttribArray(positionAttributeLocation);
  var size = 2;
  var type = GL_BEST.FLOAT;
  var normalize = false;
  var stride = 0;
  var offset = 0;
  GL_BEST.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);

  // Create a buffer for the colors.
  var buffer = GL_BEST.createBuffer();
  GL_BEST.bindBuffer(GL_BEST.ARRAY_BUFFER, buffer);
  // Set the colors.

  // Pick 2 random colors.
  var r1 = Math.random();
  var b1 = Math.random();
  var g1 = Math.random();
  var r2 = Math.random();
  var b2 = Math.random();
  var g2 = Math.random();

  GL_BEST.bufferData(
    GL_BEST.ARRAY_BUFFER,
    new Float32Array([
      g2, b1, b2, 1,
      b1, g2, g1, 1,
      r1, b1, g1, 1,
      r2, b2, b1, 1,
      b2, g2, g2, 1,
      r2, b2, g2, 1,
    ]),
    GL_BEST.STATIC_DRAW);

  // tell the color attribute how to pull data out of the current ARRAY_BUFFER
  GL_BEST.enableVertexAttribArray(colorAttributeLocation);
  var size = 4;
  var type = GL_BEST.FLOAT;
  var normalize = false;
  var stride = 0;
  var offset = 0;
  GL_BEST.vertexAttribPointer(colorAttributeLocation, size, type, normalize, stride, offset);

  // Tell WebGL how to convert from clip space to pixels
  GL_BEST.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Clear the canvas
  GL_BEST.clearColor(0, 0, 0, 0);
  GL_BEST.clear(GL_BEST.COLOR_BUFFER_BIT | GL_BEST.DEPTH_BUFFER_BIT);

  // Tell it to use our program (pair of shaders)
  GL_BEST.useProgram(program);

  // Bind the attribute/buffer set we want.
  GL_BEST.bindVertexArray(vao);

  // Pass in the canvas resolution so we can convert from
  // pixels to clipspace in the shader
  GL_BEST.uniform2f(resolutionUniformLocation, IMAGE_W, IMAGE_H);

  // draw
  var primitiveType = GL_BEST.TRIANGLES;
  var offset = 0;
  var count = 6;
  GL_BEST.drawArrays(primitiveType, offset, count);
}

// Returns a random integer from 0 to range - 1.
function randomInt(range) {
  return Math.floor(Math.random() * range);
}

function setRectangle(gl, x, y, width, height) {
  var x1 = x;
  var x2 = x + width;
  var y1 = y;
  var y2 = y + height;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    x1, y1,
    x2, y1,
    x1, y2,
    x1, y2,
    x2, y1,
    x2, y2,
  ]), gl.STATIC_DRAW);
}
