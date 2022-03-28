"use strict";

// program variables //
var TARGET_IMAGE = new Image();
var IMAGE_W = 0;
var IMAGE_H = 0;

var N_TRIANGLES = 50;
// // 

window.addEventListener('load', function () {
  document.querySelector('#upload_target_image').addEventListener('change', function () {
    if (this.files && this.files[0]) {
      TARGET_IMAGE.onload = () => {
        URL.revokeObjectURL(TARGET_IMAGE.src);  // no longer needed, free memory
        updateCanvas();
        renderBestImage();
      }

      TARGET_IMAGE.src = URL.createObjectURL(this.files[0]); // set src to blob url
      var targetImg = document.querySelector("#target_img");
      targetImg.src = TARGET_IMAGE.src;
    }
  });
});


function updateCanvas() {
  IMAGE_W = TARGET_IMAGE.width;
  IMAGE_H = TARGET_IMAGE.height;

  var targetImg = document.querySelector("#target_img");
  targetImg.width = IMAGE_W;
  targetImg.height = IMAGE_H;

  var canvas = document.querySelector("#canvas_best");
  canvas.width = IMAGE_W;
  canvas.height = IMAGE_H;
}

function renderBestImage() {
  // Get A WebGL context
  var canvas = document.querySelector("#canvas_best");
  var gl = canvas.getContext("webgl2", {
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

  // setup triangle
  // create empty triangle texture

  var triangleTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + 0);
  gl.bindTexture(gl.TEXTURE_2D, triangleTexture);

  // Set up texture so we can render any size image and so we are
  // working with pixels.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // make the texture the same size as the image
  var mipLevel = 0;               // the largest mip
  var internalFormat = gl.RGBA;   // format we want in the texture
  var border = 0;                 // must be 0
  var srcFormat = gl.RGBA;        // format of data we are supplying
  var srcType = gl.UNSIGNED_BYTE; // type of data we are supplying
  var data = null;                // no data = create a blank texture
  gl.texImage2D(
    gl.TEXTURE_2D, mipLevel, internalFormat, IMAGE_W, IMAGE_H, border,
    srcFormat, srcType, data);

  // Create a framebuffer
  var triangleFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, triangleFbo);

  // Attach a texture to it.
  var attachmentPoint = gl.COLOR_ATTACHMENT0;
  gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, triangleTexture, mipLevel);


  //// TRIANGLES

  // var drawTriangles = function () {
  // Use our boilerplate utils to compile the shaders and link into a program
  var triProgram = webglUtils.createProgramFromSources(gl, [triVertexShaderSource, triFragmentShaderSource]);

  // look up where the vertex data needs to go.
  var triPositionAttributeLocation = gl.getAttribLocation(triProgram, "a_position");
  var triColorAttributeLocation = gl.getAttribLocation(triProgram, "a_color");

  // look up uniform locations
  var triResolutionUniformLocation = gl.getUniformLocation(triProgram, "u_resolution");

  // Create set of attributes
  var triVao = gl.createVertexArray();
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

  // Tell it to use our program (pair of shaders)
  gl.useProgram(triProgram);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(triVao);

  // gl.activeTexture(gl.TEXTURE0 + 0);
  // gl.bindTexture(gl.TEXTURE_2D, triangleTexture);

  // fb
  gl.bindFramebuffer(gl.FRAMEBUFFER, triangleFbo);
  gl.uniform2f(triResolutionUniformLocation, IMAGE_W, IMAGE_H);
  gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);



  // Pass in the canvas resolution so we can convert from
  // pixels to clipspace in the shader
  //gl.uniform2f(triResolutionUniformLocation, IMAGE_W, IMAGE_H);

  // draw
  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = N_TRIANGLES;
  gl.drawArrays(primitiveType, offset, count);
  // }
  // 

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);




  // var drawImg = function () {
  // setup GLSL program
  var imgProgram = webglUtils.createProgramFromSources(gl,
    [imgVertexShaderSource, imgFragmentShaderSource]);

  // look up where the vertex data needs to go.
  var imgPositionAttributeLocation = gl.getAttribLocation(imgProgram, "a_position");
  var imgTexCoordAttributeLocation = gl.getAttribLocation(imgProgram, "a_texCoord");

  // lookup uniforms
  var imgResolutionLocation = gl.getUniformLocation(imgProgram, "u_resolution");
  var imgTargetImageLocation = gl.getUniformLocation(imgProgram, "u_targetImage");
  var imgTriangleImageLocation = gl.getUniformLocation(imgProgram, "u_triangleImage");

  // Create a vertex array object (attribute state)
  var imgVao = gl.createVertexArray();

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

  // Create a texture and put the image in it.
  var targetImgTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + 1);
  gl.bindTexture(gl.TEXTURE_2D, targetImgTexture);

  // Set up texture so we can render any size image and so we are
  // working with pixels.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // Upload the image into the texture.
  var mipLevel = 0;               // the largest mip
  var internalFormat = gl.RGBA;   // format we want in the texture
  var srcFormat = gl.RGBA;        // format of data we are supplying
  var srcType = gl.UNSIGNED_BYTE; // type of data we are supplying
  gl.texImage2D(gl.TEXTURE_2D,
    mipLevel,
    internalFormat,
    srcFormat,
    srcType,
    TARGET_IMAGE);

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(imgProgram);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(imgVao);

  // Pass in the canvas resolution so we can convert from
  // pixels to clipspace in the shader
  // gl.uniform2f(imgResolutionLocation, IMAGE_W, IMAGE_H);

  // Tell the shader to get the texture from texture unit 0
  gl.activeTexture(gl.TEXTURE0 + 0);
  gl.bindTexture(gl.TEXTURE_2D, triangleTexture);
  gl.uniform1i(imgTriangleImageLocation, 0);

  gl.activeTexture(gl.TEXTURE0 + 1);
  gl.bindTexture(gl.TEXTURE_2D, targetImgTexture);
  gl.uniform1i(imgTargetImageLocation, 1);

  // Bind the position buffer so gl.bufferData that will be called
  // in setRectangle puts data in the position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, imgPositionBuffer);

  // Set a rectangle the same size as the image.
  setRectangle(gl, 0, 0, IMAGE_W, IMAGE_H);


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
  // }

  // requestAnimationFrame(drawTriangles);
  // requestAnimationFrame(drawImg);
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