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

  function createAndSetupTexture(gl) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set up texture so we can render any size image and so we are
    // working with pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return texture;
  }

  // setup triangle
  // create empty triangle texture
  var triangleTexture = createAndSetupTexture(gl);

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
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, triangleTexture, mipLevel);


  // // Bind the position buffer so gl.bufferData that will be called
  // // in setRectangle puts data in the position buffer
  // gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // // Set a rectangle the same size as the image.
  // setRectangle(gl, 0, 0, image.width, image.height);






  // setup GLSL program
  var imgProgram = webglUtils.createProgramFromSources(gl,
    [imgVertexShaderSource, imgFragmentShaderSource]);

  // look up where the vertex data needs to go.
  var imgPositionAttributeLocation = gl.getAttribLocation(imgProgram, "a_position");
  var imgTexCoordAttributeLocation = gl.getAttribLocation(imgProgram, "a_texCoord");

  // lookup uniforms
  var imgResolutionLocation = gl.getUniformLocation(imgProgram, "u_resolution");
  var imgImageLocation = gl.getUniformLocation(imgProgram, "u_image");

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
  var targetImageTexture = createAndSetupTexture(gl);

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
  gl.uniform2f(imgResolutionLocation, IMAGE_W, IMAGE_H);

  // Tell the shader to get the texture from texture unit 0
  gl.uniform1i(imgImageLocation, 0);

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


































  // ////////////////////////////
  // // TRI PROGRAM SETUP
  // ////////////////////////////

  // var triVertexShader = gl.createShader(gl.VERTEX_SHADER);
  // gl.shaderSource(triVertexShader, triVertexShaderSource);
  // gl.compileShader(triVertexShader);

  // if (!gl.getShaderParameter(triVertexShader, gl.COMPILE_STATUS)) {
  //   console.error(gl.getShaderInfoLog(triVertexShader));
  // }

  // var triFragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  // gl.shaderSource(triFragmentShader, triFragmentShaderSource);
  // gl.compileShader(triFragmentShader);

  // if (!gl.getShaderParameter(triFragmentShader, gl.COMPILE_STATUS)) {
  //   console.error(gl.getShaderInfoLog(triFragmentShader));
  // }

  // var triProgram = gl.createProgram();
  // gl.attachShader(triProgram, triVertexShader);
  // gl.attachShader(triProgram, triFragmentShader);
  // gl.linkProgram(triProgram);

  // if (!gl.getProgramParameter(triProgram, gl.LINK_STATUS)) {
  //   console.error(gl.getProgramInfoLog(triProgram));
  // }

  // //////////////////////////////////////////
  // // GET TRI PROGRAM UNIFORM LOCATIONS
  // //////////////////////////////////////////

  // var triResolutionUniformLocation = gl.getUniformLocation(triProgram, "u_resolution");

  // ////////////////////////////
  // // TRI SETUP
  // ////////////////////////////

  // var triFrameBuffer = gl.createFramebuffer();
  // gl.bindFramebuffer(gl.FRAMEBUFFER, triFrameBuffer);

  // gl.activeTexture(gl.TEXTURE0);

  // var triTarget = gl.createTexture();
  // gl.bindTexture(gl.TEXTURE_2D, triTarget);
  // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, IMAGE_W, IMAGE_H); // 32f insteaf of 16f
  // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, triTarget, 0);

  // gl.drawBuffers([
  //   gl.COLOR_ATTACHMENT0,
  // ]);


  // gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // /////////////////////////////
  // // MAIN PROGRAM SETUP
  // /////////////////////////////

  // var imgVertexShader = gl.createShader(gl.VERTEX_SHADER);
  // gl.shaderSource(imgVertexShader, imgVertexShaderSource);
  // gl.compileShader(imgVertexShader);

  // if (!gl.getShaderParameter(imgVertexShader, gl.COMPILE_STATUS)) {
  //   console.error(gl.getShaderInfoLog(imgVertexShader));
  // }

  // var imgFragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  // gl.shaderSource(imgFragmentShader, imgFragmentShaderSource);
  // gl.compileShader(imgFragmentShader);

  // if (!gl.getShaderParameter(imgFragmentShader, gl.COMPILE_STATUS)) {
  //   console.error(gl.getShaderInfoLog(imgFragmentShader));
  // }

  // var imgProgram = gl.createProgram();
  // gl.attachShader(imgProgram, imgVertexShader);
  // gl.attachShader(imgProgram, imgFragmentShader);
  // gl.linkProgram(imgProgram);

  // if (!gl.getProgramParameter(imgProgram, gl.LINK_STATUS)) {
  //   console.error(gl.getProgramInfoLog(imgProgram));
  // }

  // //////////////////////////////////////////////
  // // GET MAIN PROGRAM UNIFORM LOCATIONS
  // //////////////////////////////////////////////

  // var imgResolutionLocation = gl.getUniformLocation(imgProgram, "u_resolution");
  // //var imgImageLocation = gl.getUniformLocation(imgProgram, "u_image");

  // ///////////////////////
  // // GEOMETRY SET UP
  // ///////////////////////

  // var triVertexArray = gl.createVertexArray();
  // gl.bindVertexArray(triVertexArray);

  // // triangle buffers
  // var trianglePositions = [];
  // for (let i = 0; i < N_TRIANGLES * 3; i++) {
  //   trianglePositions.push(Math.random() * IMAGE_W);  // random x
  //   trianglePositions.push(Math.random() * IMAGE_H);  // random y
  // }

  // var triangleColors = [];
  // for (let i = 0; i < N_TRIANGLES; i++) {
  //   var r = Math.random();
  //   var g = Math.random();
  //   var b = Math.random();
  //   var a = Math.random();

  //   for (let c = 0; c < 3; c++) {
  //     triangleColors.push(r);
  //     triangleColors.push(g);
  //     triangleColors.push(b);
  //     triangleColors.push(a);
  //   }
  // }

  // var triPositionAttributeLocation = gl.getAttribLocation(triProgram, "a_position");
  // var triColorAttributeLocation = gl.getAttribLocation(triProgram, "a_color");

  // var triPositionBuffer = gl.createBuffer();
  // gl.bindBuffer(gl.ARRAY_BUFFER, triPositionBuffer);
  // gl.bufferData(gl.ARRAY_BUFFER, trianglePositions, gl.STATIC_DRAW);
  // gl.vertexAttribPointer(triPositionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  // gl.enableVertexAttribArray(triPositionAttributeLocation);

  // var triColorBuffer = gl.createBuffer();
  // gl.bindBuffer(gl.ARRAY_BUFFER, triColorBuffer);
  // gl.bufferData(gl.ARRAY_BUFFER, triangleColors, gl.STATIC_DRAW);
  // gl.vertexAttribPointer(triColorAttributeLocation, 4, gl.FLOAT, false, 0, 0);
  // gl.enableVertexAttribArray(triColorAttributeLocation);

  // // image buffers
  // var imagePositions = [
  //   0.0, 0.0,
  //   0.0, 1.0,
  //   1.0, 0.0,
  //   1.0, 0.0,
  //   0.0, 1.0,
  //   1.0, 1.0,
  // ];

  // var imageTexcoords = [
  //   0.0, 0.0,
  //   1.0, 0.0,
  //   0.0, 1.0,
  //   0.0, 1.0,
  //   1.0, 0.0,
  //   1.0, 1.0,
  // ];

  // // image buffers?

  // gl.bindVertexArray(null);

  // ////////////////////
  // // UNIFORM DATA
  // ////////////////////

  // // skip

  // // draw

  // //////////////////
  // // BIND TEXTURES
  // //////////////////

  // gl.activeTexture(gl.TEXTURE0);
  // gl.bindTexture(gl.TEXTURE_2D, triTarget);

  // //////////////////////////////
  // // SET MAIN PROGRAM UNIFORMS
  // //////////////////////////////

  // gl.useProgram(imgProgram);
  // //gl.uniform1i(imgImageLocation, 0);
  // gl.uniform2fv(imgResolutionLocation, [IMAGE_W, IMAGE_H]);


  // function draw() {

  //   /////////////////////////
  //   // DRAW TRI
  //   /////////////////////////

  //   gl.bindFramebuffer(gl.FRAMEBUFFER, triFrameBuffer);
  //   gl.useProgram(triProgram);
  //   gl.bindVertexArray(triVertexArray);

  //   gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //  // draw
  //  var primitiveType = gl.TRIANGLES;
  //  var offset = 0;
  //  var count = N_TRIANGLES;
  //  gl.drawArrays(primitiveType, offset, count);

  //  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  //  gl.useProgram(imgProgram);
  //  gl.bindVertexArray(imgVertexArray);
  //  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


  //  var primitiveType = gl.TRIANGLES;
  //  var offset = 0;
  //  var count = 6;
  //  gl.drawArrays(primitiveType, offset, count);
  // }














  // var imageArrays = {
  //   position: { numComponents: 2, data: imagePositions, },
  //   texCoord: { numComponents: 2, data: imageTexcoords, },
  // };
  // var imageBufferInfo = twgl.createBufferInfoFromArrays(gl, imageArrays);

  // // program
  // // var triangleProgramInfo = twgl.createProgramInfo(gl, [triangleVertexShaderSource, triangleFragmentShaderSource]);
  // var imageProgramInfo = twgl.createProgramInfo(gl, [imageVertexShaderSource, imageFragmentShaderSource]);

  // //var triangleVao = twgl.createVAOFromBufferInfo(gl, triangleProgramInfo, triangleBufferInfo);
  // var imageVao = twgl.createVAOFromBufferInfo(gl, imageProgramInfo, imageBufferInfo);

  // // // Create a texture to render to
  // // const targetTexture = gl.createTexture();
  // // gl.bindTexture(gl.TEXTURE_2D, targetTexture);

  // // {
  // //   // define size and format of level 0
  // //   const level = 0;
  // //   const internalFormat = gl.RGBA;
  // //   const border = 0;
  // //   const format = gl.RGBA;
  // //   const type = gl.UNSIGNED_BYTE;
  // //   const data = null;
  // //   gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
  // //                 IMAGE_W, IMAGE_H, border,
  // //                 format, type, data);

  // //   // set the filtering so we don't need mips
  // //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  // //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  // //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  // //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // // }

  // // // Create and bind the framebuffer
  // // const fb = gl.createFramebuffer();
  // // gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

  // // // attach the texture as the first color attachment
  // // const attachmentPoint = gl.COLOR_ATTACHMENT0;
  // // const level = 0;
  // // gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, level);

  // var drawTriangles = function () {

  //   gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  //   gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  //   gl.clearColor(0, 0, 0, 0);
  //   gl.clear(gl.COLOR_BUFFER_BIT);

  //   gl.useProgram(triangleProgramInfo.program);

  //   // Setup all the needed attributes.
  //   gl.bindVertexArray(triangleVao);

  //   // Set the uniforms that are the same for all objects.
  //   twgl.setUniforms(triangleProgramInfo, {
  //     u_resolution: [IMAGE_W, IMAGE_H],
  //   });

  //   // draw
  //   var primitiveType = gl.TRIANGLES;
  //   var offset = 0;
  //   var count = N_TRIANGLES;
  //   gl.drawArrays(primitiveType, offset, count);
  // }

  // var drawImage = function () {

  //   //gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  //   //gl.activeTexture(gl.TEXTURE0 + 0);
  //   //gl.bindTexture(gl.TEXTURE_2D, targetTexture);

  //   gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  //   gl.clearColor(0, 0, 0, 0);
  //   gl.clear(gl.COLOR_BUFFER_BIT);

  //   gl.useProgram(imageProgramInfo.program);

  //   // Setup all the needed attributes.
  //   gl.bindVertexArray(imageVao);

  //   // Set the uniforms that are the same for all objects.
  //   twgl.setUniforms(imageProgramInfo, {
  //     u_resolution: [IMAGE_W, IMAGE_H],
  //     //u_image: targetTexture,
  //   });

  //   // draw
  //   var primitiveType = gl.TRIANGLES;
  //   var offset = 0;
  //   var count = 6;
  //   gl.drawArrays(primitiveType, offset, count);
  // }

  // //drawTriangles();
  // drawImage();
// }