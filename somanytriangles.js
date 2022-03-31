"use strict";

// program variables //
var TARGET_IMAGE = new Image();
var IMAGE_W = 0;
var IMAGE_H = 0;

var N_TRIANGLES = 50;

var canvas = 0;
var gl = 0;

// triangle  shader
var triProgram = 0;
var triVao = 0;
var triangleFbo = 0;
var triResolutionUniformLocation = 0;
var triMutIndexUniformLocation = 0;
var triMutTypeUniformLocation = 0;
var triMutNewValUniformLocation = 0;

// similarity shader
var similarityFbo = 0;

// draw to canvas shader
var imgProgram = 0;
var imgVao = 0;
var imgTriangleImageLocation = 0;
var imgTargetImageLocation = 0;
var imgResolutionLocation = 0;

// textures
var triangleTexture = 0;
var targetImgTexture = 0;
var similarityTexture = 0;


// // 

window.addEventListener('load', function () {
  document.querySelector('#upload_target_image').addEventListener('change', function () {
    if (this.files && this.files[0]) {
      TARGET_IMAGE.onload = () => {
        URL.revokeObjectURL(TARGET_IMAGE.src);  // no longer needed, free memory
        updateImageInfo();
        render();
      }

      TARGET_IMAGE.src = URL.createObjectURL(this.files[0]); // set src to blob url
      var targetImg = document.querySelector("#target_img");
      targetImg.src = TARGET_IMAGE.src;
    }
  });
});


function updateImageInfo() {
  IMAGE_W = TARGET_IMAGE.width;
  IMAGE_H = TARGET_IMAGE.height;

  var targetImg = document.querySelector("#target_img");
  targetImg.width = IMAGE_W;
  targetImg.height = IMAGE_H;

  canvas = document.querySelector("#canvas_best");
  canvas.width = IMAGE_W;
  canvas.height = IMAGE_H;
}

function setupTextures() {
  //
  triangleTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, triangleTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, IMAGE_W, IMAGE_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  // (gl.TEXTURE_2D, mipLevel, internalFormat, IMAGE_W, IMAGE_H, border, srcFormat, srcType, data)

  //
  targetImgTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, targetImgTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, TARGET_IMAGE);

  //
  similarityTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, similarityTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, IMAGE_W, IMAGE_H, 0, gl.RED, gl.FLOAT, null);

  gl.bindTexture(gl.TEXTURE_2D, null);
}

function setupFrameBuffers() {
  // Create a framebuffer
  triangleFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, triangleFbo);

  // Attach a texture to it.
  var attachmentPoint = gl.COLOR_ATTACHMENT0;
  var mipLevel = 0;               // the largest mip
  gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, triangleTexture, mipLevel);

  // Create a framebuffer
  similarityFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, similarityFbo);

  // Attach a texture to it.
  var attachmentPoint = gl.COLOR_ATTACHMENT0;
  var mipLevel = 0;               // the largest mip
  gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, similarityTexture, mipLevel);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function setupTriProgram() {
  triProgram = webglUtils.createProgramFromSources(gl, [renderTriVertSource, renderTriFragSource]);

  // look up where the vertex data needs to go.
  var triPositionAttributeLocation = gl.getAttribLocation(triProgram, "a_position");
  var triColorAttributeLocation = gl.getAttribLocation(triProgram, "a_color");

  // look up uniform locations
  triResolutionUniformLocation = gl.getUniformLocation(triProgram, "u_resolution");
  triMutIndexUniformLocation = gl.getUniformLocation(triProgram, "u_mutIndex");
  triMutTypeUniformLocation = gl.getUniformLocation(triProgram, "u_mutAttrType");
  triMutNewValUniformLocation = gl.getUniformLocation(triProgram, "u_mutNewVal");

  // Create set of attributes
  triVao = gl.createVertexArray();
  gl.bindVertexArray(triVao);

  // Create a buffer for the positons.
  var triPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triPositionBuffer);

  var triPositions = [];
  for (let i = 0; i < N_TRIANGLES * 3; i++) {
    triPositions.push(Math.random() * IMAGE_W);  // random x
    triPositions.push(Math.random() * IMAGE_H);  // random y
  }

  // Set Geometry.
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(triPositions),
    gl.STATIC_DRAW);

  // tell the position attribute how to pull data out of the current ARRAY_BUFFER
  gl.enableVertexAttribArray(triPositionAttributeLocation);
  var size = 2;
  var type = gl.FLOAT;
  var normalize = false;
  var stride = 0;
  var offset = 0;
  gl.vertexAttribPointer(triPositionAttributeLocation, size, type, normalize, stride, offset);

  // Create a buffer for the colors.
  var triColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triColorBuffer);
  // Set the colors.

  var triColors = [];
  for (let i = 0; i < N_TRIANGLES; i++) {
    var r = Math.random();
    var g = Math.random();
    var b = Math.random();
    var a = Math.random();

    for (let c = 0; c < 3; c++) {
      triColors.push(r);
      triColors.push(g);
      triColors.push(b);
      triColors.push(a);
    }
  }

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(triColors),
    gl.STATIC_DRAW);

  // tell the color attribute how to pull data out of the current ARRAY_BUFFER
  gl.enableVertexAttribArray(triColorAttributeLocation);
  var size = 4;
  var type = gl.FLOAT;
  var normalize = false;
  var stride = 0;
  var offset = 0;
  gl.vertexAttribPointer(triColorAttributeLocation, size, type, normalize, stride, offset);
}

function setupRenderToCanvasProgram() {
  // setup GLSL program
  imgProgram = webglUtils.createProgramFromSources(gl, [similarityVertSource, similarityFragSource]);

  // look up where the vertex data needs to go.
  var imgPositionAttributeLocation = gl.getAttribLocation(imgProgram, "a_position");
  var imgTexCoordAttributeLocation = gl.getAttribLocation(imgProgram, "a_texCoord");

  // lookup uniforms
  imgResolutionLocation = gl.getUniformLocation(imgProgram, "u_resolution");
  imgTargetImageLocation = gl.getUniformLocation(imgProgram, "u_targetImage");
  imgTriangleImageLocation = gl.getUniformLocation(imgProgram, "u_triangleImage");

  // Create a vertex array object (attribute state)
  imgVao = gl.createVertexArray();

  // and make it the one we're currently working with
  gl.bindVertexArray(imgVao);

  // Create a buffer and put a single pixel space rectangle in
  // it (2 triangles)
  var imgPositionBuffer = gl.createBuffer();

  // Turn on the attribute
  gl.enableVertexAttribArray(imgPositionAttributeLocation);

  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, imgPositionBuffer);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  var size = 2;          // 2 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(
    imgPositionAttributeLocation, size, type, normalize, stride, offset);

  // provide texture coordinates for the rectangle.
  var imgTexCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, imgTexCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    0.0, 1.0,
    0.0, 1.0,
    1.0, 0.0,
    1.0, 1.0,
  ]), gl.STATIC_DRAW);

  // Turn on the attribute
  gl.enableVertexAttribArray(imgTexCoordAttributeLocation);

  // Tell the attribute how to get data out of texCoordBuffer (ARRAY_BUFFER)
  var size = 2;          // 2 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(
    imgTexCoordAttributeLocation, size, type, normalize, stride, offset);

  // Bind the position buffer so gl.bufferData that will be called
  // in setRectangle puts data in the position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, imgPositionBuffer);

  // Set a rectangle the same size as the image.
  setRectangle(gl, 0, 0, IMAGE_W, IMAGE_H);
}

function renderTriangles() {
  // Tell it to use our program (pair of shaders)
  gl.useProgram(triProgram);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(triVao);

  // fb
  gl.bindFramebuffer(gl.FRAMEBUFFER, triangleFbo);
  gl.uniform2f(triResolutionUniformLocation, IMAGE_W, IMAGE_H);
  gl.uniform1i(triMutIndexUniformLocation, Math.floor(Math.random() * N_TRIANGLES * 3));
  gl.uniform1i(triMutTypeUniformLocation, Math.floor(Math.random() * 6));
  gl.uniform1f(triMutNewValUniformLocation, Math.random());
  gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // draw
  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = N_TRIANGLES;
  gl.drawArrays(primitiveType, offset, count);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function renderToCanvas() {
  gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(imgProgram);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(imgVao);

  // Tell the shader to get the texture from texture unit 0
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, triangleTexture);
  gl.uniform1i(imgTriangleImageLocation, 0);

  //gl.generateMipmap(gl.TEXTURE_2D);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, targetImgTexture);
  gl.uniform1i(imgTargetImageLocation, 1);

  //gl.generateMipmap(gl.TEXTURE_2D);



  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.uniform2f(imgResolutionLocation, IMAGE_W, IMAGE_H);
  gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Draw the rectangle.
  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = 6;
  gl.drawArrays(primitiveType, offset, count);
}

function render() {
  // Get A WebGL context
  gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false  // Ask for non-premultiplied alpha
  });
  if (!gl) {
    console.error("WebGL 2 not available");
    return;
  }

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);

  if (!gl.getExtension("EXT_color_buffer_float")) {
    console.error("FLOAT color buffer not available");
  }

  setupTextures();
  setupFrameBuffers();

  setupTriProgram();
  setupRenderToCanvasProgram();

  //while (true) {
  requestAnimationFrame(renderLoop)
  //}
}

function renderLoop() {
  renderTriangles();
  renderToCanvas();

  requestAnimationFrame(renderLoop);
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