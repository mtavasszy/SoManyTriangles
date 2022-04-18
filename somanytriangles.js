"use strict";

// program variables //
var TARGET_IMAGE = new Image();
var IMAGE_W = 0;
var IMAGE_H = 0;

var N_TRIANGLES = 50;

var canvas = 0;
var gl = 0;

var totalIterations = 0;

var animationFrame = 0;
var iterationsPerFrame = 100;
var animationFramePrevTime = 0;
var elapsedIterations = 0;
var ipsElem = 0;
var totalItElem = 0;

// triangle shader
var triProgram = 0;
var triVao = 0;
var triTf = 0;
var triangleFbo = 0;
var triResolutionUniformLocation = 0;
var triMutIndexUniformLocation = 0;
var triMutTypeUniformLocation = 0;
var triMutNewValUniformLocation = 0;
var triPositionBuffer = 0;
var triColorBuffer = 0;

// similarity shader
var similarityProgram = 0;
var similarityVao = 0;
var similarityFbo = 0;
var similarityTriangleImageLocation = 0;
var similarityTargetImageLocation = 0;
var similarityResolutionLocation = 0;

// sum similarity shader
var sumSimilarityProgram = 0;
var sumSimilarityVao = [];
var sumSimilarityFbo = [];
var sumSimilaritySrcImageLocation = 0;
var sumSimilaritySrcResolutionLocation = 0;
var sumSimilarityDstResolutionLocation = 0;
var sumSimilarityMaxLvl = 0;

// copy mutation shader
var copyMutProgram = 0;
var copyMutVao = 0;
var copyMutTf = 0;
var copyMutPositionBuffer = 0;
var copyMutColorBuffer = 0;
var copyMutMutatedPositionBuffer = 0;
var copyMutMutatedColorBuffer = 0;
var copyMutMaxMipmapLvlLocation = 0;
var copyMutSimilarityImageLocation = 0;
var copyMutMaxSimilarityImageLocation = 0;

// copy best similarity shader
var copyBestCurrent = 0;
var copyBestProgram = 0;
var copyBestVao = 0;
var copyBestFbo = [];
var copyBestResolutionLocation = 0;
var copyBestMaxMipmapLvlLocation = 0;
var copyBestSimilarityImageLocation = 0;
var copyBestMaxSimilarityImageLocation = 0;

// render to canvas shader
var rtcProgram = 0;
var rtcVao = 0;
var rtcImageLocation = 0;
var rtcResolutionLocation = 0;

// textures
var triangleTexture = 0;
var targetImgTexture = 0;
var similarityTexture = 0;
var sumSimilarityTexture = [];
var bestSimilarityTexture = [];

// buffers
var texRectBuffer = new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0]);


var prevbest = 0;

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

  function log4(x) {
    return Math.log10(x) / Math.log10(4);
  }

  sumSimilarityMaxLvl = Math.ceil(log4(Math.max(IMAGE_W, IMAGE_H)));

  ipsElem = document.querySelector("#iterations_per_sec");
  totalItElem = document.querySelector("#total_iterations");

}

function setupTexture() {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  return texture;
}

function setupTextures() {
  triangleTexture = setupTexture()
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, IMAGE_W, IMAGE_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  // (gl.TEXTURE_2D, mipLevel, internalFormat, IMAGE_W, IMAGE_H, border, srcFormat, srcType, data)

  targetImgTexture = setupTexture()
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, TARGET_IMAGE);

  similarityTexture = setupTexture()
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, IMAGE_W, IMAGE_H, 0, gl.RED, gl.FLOAT, null);

  bestSimilarityTexture[0] = setupTexture()
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array([0]));

  bestSimilarityTexture[1] = setupTexture()
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array([0]));

  var resX = Math.ceil(IMAGE_W / 4);
  var resY = Math.ceil(IMAGE_H / 4);

  for (var i = 0; i < sumSimilarityMaxLvl; i++) {
    sumSimilarityTexture[i] = setupTexture()
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, resX, resY, 0, gl.RED, gl.FLOAT, null);

    var resX = Math.ceil(resX / 4);
    var resY = Math.ceil(resY / 4);
  }

  gl.bindTexture(gl.TEXTURE_2D, null);
}

function setupFrameBuffer(texture) {
  var fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  return fbo;
}

function setupFrameBuffers() {
  triangleFbo = setupFrameBuffer(triangleTexture);

  similarityFbo = setupFrameBuffer(similarityTexture);

  for (var i = 0; i < sumSimilarityMaxLvl; i++) {
    sumSimilarityFbo[i] = setupFrameBuffer(sumSimilarityTexture[i]);
  }

  copyBestFbo[0] = setupFrameBuffer(bestSimilarityTexture[0]);
  copyBestFbo[1] = setupFrameBuffer(bestSimilarityTexture[1]);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function createShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(gl, shaderSources, transformFeedbackVaryings) {
  const program = gl.createProgram();
  [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].forEach((type, ndx) => {
    const shader = createShader(gl, type, shaderSources[ndx]);
    gl.attachShader(program, shader);
  });
  if (transformFeedbackVaryings) {
    gl.transformFeedbackVaryings(
      program,
      transformFeedbackVaryings,
      gl.SEPARATE_ATTRIBS,
    );
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramParameter(program));
  }
  return program;
}

function setVertexBuffer(data, usage, attributeLocation, size, type) {
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  gl.bufferData(gl.ARRAY_BUFFER, data, usage);

  gl.enableVertexAttribArray(attributeLocation);
  gl.vertexAttribPointer(attributeLocation, size, type, false, 0, 0);

  return buffer
}

function getRectData(w, h) {
  return new Float32Array([0, 0, w, 0, 0, h, 0, h, w, 0, w, h])
}

function setupTriProgram() {
  triProgram = createProgram(gl, [renderTriVertSource, renderTriFragSource], ['tf_position', 'tf_color', 'tf_mutated_position', 'tf_mutated_color']);

  // look up where the vertex data needs to go.
  var triPositionAttributeLocation = gl.getAttribLocation(triProgram, "a_position");
  var triColorAttributeLocation = gl.getAttribLocation(triProgram, "a_color");

  // look up uniform locations
  triResolutionUniformLocation = gl.getUniformLocation(triProgram, "u_resolution");
  triMutIndexUniformLocation = gl.getUniformLocation(triProgram, "u_mutIndex");
  triMutTypeUniformLocation = gl.getUniformLocation(triProgram, "u_mutAttrType");
  triMutNewValUniformLocation = gl.getUniformLocation(triProgram, "u_mutNewVal");

  // random triangles
  var triPositions = [];
  var triColors = [];

  //var z = 0;
  for (let i = 0; i < N_TRIANGLES; i++) {
    var r = Math.random();
    var g = Math.random();
    var b = Math.random();
    var a = Math.random();

    for (let c = 0; c < 3; c++) {
      triPositions.push(Math.random() * IMAGE_W);  // random x
      triPositions.push(Math.random() * IMAGE_H);  // random y

      triColors.push(r);
      triColors.push(g);
      triColors.push(b);
      triColors.push(a);
    }
  }

  // VAO TRI
  // Create set of attributes
  triVao = gl.createVertexArray();
  gl.bindVertexArray(triVao);

  triPositionBuffer = setVertexBuffer(new Float32Array(triPositions), gl.DYNAMIC_DRAW, triPositionAttributeLocation, 2, gl.FLOAT);
  triColorBuffer = setVertexBuffer(new Float32Array(triColors), gl.DYNAMIC_DRAW, triColorAttributeLocation, 4, gl.FLOAT);
  
}

function setupSimilarityProgram() {
  // setup GLSL program
  similarityProgram = webglUtils.createProgramFromSources(gl, [similarityVertSource, similarityFragSource]);

  // look up where the vertex data needs to go.
  var similarityPositionAttributeLocation = gl.getAttribLocation(similarityProgram, "a_position");
  var similarityTexCoordAttributeLocation = gl.getAttribLocation(similarityProgram, "a_texCoord");

  // lookup uniforms
  similarityResolutionLocation = gl.getUniformLocation(similarityProgram, "u_resolution");
  similarityTargetImageLocation = gl.getUniformLocation(similarityProgram, "u_targetImage");
  similarityTriangleImageLocation = gl.getUniformLocation(similarityProgram, "u_triangleImage");

  // Create a vertex array object (attribute state)
  similarityVao = gl.createVertexArray();

  // and make it the one we're currently working with
  gl.bindVertexArray(similarityVao);

  var similarityPositionBuffer = setVertexBuffer(getRectData(IMAGE_W, IMAGE_H), gl.STATIC_DRAW, similarityPositionAttributeLocation, 2, gl.FLOAT)
  var similarityTexCoordBuffer = setVertexBuffer(texRectBuffer, gl.STATIC_DRAW, similarityTexCoordAttributeLocation, 2, gl.FLOAT);
}

function setupSumSimilarityProgram() {
  // setup GLSL program
  sumSimilarityProgram = webglUtils.createProgramFromSources(gl, [sumSimilarityVertSource, sumSimilarityFragSource]);

  // look up where the vertex data needs to go.
  var sumSimilarityPositionAttributeLocation = gl.getAttribLocation(sumSimilarityProgram, "a_position");
  var sumSimilarityTexCoordAttributeLocation = gl.getAttribLocation(sumSimilarityProgram, "a_texCoord");

  // lookup uniforms
  sumSimilaritySrcResolutionLocation = gl.getUniformLocation(sumSimilarityProgram, "u_srcResolution");
  sumSimilarityDstResolutionLocation = gl.getUniformLocation(sumSimilarityProgram, "u_dstResolution");
  sumSimilaritySrcImageLocation = gl.getUniformLocation(sumSimilarityProgram, "u_srcImage");

  var resX = IMAGE_W;
  var resY = IMAGE_H;

  for (var i = 0; i < sumSimilarityMaxLvl; i++) {
    resX = Math.ceil(resX / 4);
    resY = Math.ceil(resY / 4);
    
    sumSimilarityVao[i] = gl.createVertexArray();
    gl.bindVertexArray(sumSimilarityVao[i]);

    var sumSimilarityPositionBuffer = setVertexBuffer(getRectData(resX, resY), gl.STATIC_DRAW, sumSimilarityPositionAttributeLocation, 2, gl.FLOAT)
    var sumSimilarityTexCoordBuffer = setVertexBuffer(texRectBuffer, gl.STATIC_DRAW, sumSimilarityTexCoordAttributeLocation, 2, gl.FLOAT);
  }
}

function setupCopyMutProgram() {
  copyMutProgram = createProgram(gl, [copyMutationVertSource, copyMutationFragSource], ['tf_position', 'tf_color']);

  // look up where the vertex data needs to go.
  var copyMutPositionAttributeLocation = gl.getAttribLocation(copyMutProgram, "a_position");
  var copyMutColorAttributeLocation = gl.getAttribLocation(copyMutProgram, "a_color");
  var copyMutMutatedPositionAttributeLocation = gl.getAttribLocation(copyMutProgram, "a_mutated_position");
  var copyMutMutatedColorAttributeLocation = gl.getAttribLocation(copyMutProgram, "a_mutated_color");

  // lookup uniforms
  copyMutSimilarityImageLocation = gl.getUniformLocation(copyMutProgram, "u_similarityImage");
  copyMutMaxSimilarityImageLocation = gl.getUniformLocation(copyMutProgram, "u_maxSimilarityImage");

  // random triangles
  var triPositions = [];
  var triColors = [];

  //var z = 0;
  for (let i = 0; i < N_TRIANGLES; i++) {
    for (let c = 0; c < 3; c++) {
      triPositions.push(0);
      triPositions.push(0);

      triColors.push(0);
      triColors.push(0);
      triColors.push(0);
      triColors.push(0);
    }
  }

  // VAO COPY MUT
  copyMutVao = gl.createVertexArray();
  gl.bindVertexArray(copyMutVao);

  copyMutPositionBuffer = setVertexBuffer(new Float32Array(triPositions), gl.DYNAMIC_DRAW, copyMutPositionAttributeLocation, 2, gl.FLOAT);
  copyMutColorBuffer = setVertexBuffer(new Float32Array(triColors), gl.DYNAMIC_DRAW, copyMutColorAttributeLocation, 4, gl.FLOAT);
  copyMutMutatedPositionBuffer = setVertexBuffer(new Float32Array(triPositions), gl.DYNAMIC_DRAW, copyMutMutatedPositionAttributeLocation, 2, gl.FLOAT);
  copyMutMutatedColorBuffer = setVertexBuffer(new Float32Array(triColors), gl.DYNAMIC_DRAW, copyMutMutatedColorAttributeLocation, 4, gl.FLOAT);
}

function setupCopyBestProgram() {
  // setup GLSL program
  copyBestProgram = webglUtils.createProgramFromSources(gl, [copyBestVertSource, copyBestFragSource]);

  // look up where the vertex data needs to go.
  var copyBestPositionAttributeLocation = gl.getAttribLocation(copyBestProgram, "a_position");
  var copyBestTexCoordAttributeLocation = gl.getAttribLocation(copyBestProgram, "a_texCoord");

  // lookup uniforms
  copyBestResolutionLocation = gl.getUniformLocation(copyBestProgram, "u_resolution");
  copyBestSimilarityImageLocation = gl.getUniformLocation(copyBestProgram, "u_similarityImage");
  copyBestMaxSimilarityImageLocation = gl.getUniformLocation(copyBestProgram, "u_maxSimilarityImage");

  // Create a vertex array object (attribute state)
  copyBestVao = gl.createVertexArray();
  gl.bindVertexArray(copyBestVao);

  var copyBestPositionBuffer = setVertexBuffer(getRectData(1,1), gl.STATIC_DRAW, copyBestPositionAttributeLocation, 2, gl.FLOAT);
  var copyBestTexCoordBuffer = setVertexBuffer(texRectBuffer, gl.STATIC_DRAW, copyBestTexCoordAttributeLocation, 2, gl.FLOAT);
}

function setupRenderToCanvasProgram() {
  // setup GLSL program
  rtcProgram = webglUtils.createProgramFromSources(gl, [rtcVertSource, rtcFragSource]);

  // look up where the vertex data needs to go.
  var rtcPositionAttributeLocation = gl.getAttribLocation(rtcProgram, "a_position");
  var rtcTexCoordAttributeLocation = gl.getAttribLocation(rtcProgram, "a_texCoord");

  // lookup uniforms
  rtcResolutionLocation = gl.getUniformLocation(rtcProgram, "u_resolution");
  rtcImageLocation = gl.getUniformLocation(rtcProgram, "u_image");

  // Create a vertex array object (attribute state)
  rtcVao = gl.createVertexArray();
  gl.bindVertexArray(rtcVao);

  var rtcPositionBuffer = setVertexBuffer(getRectData(IMAGE_W, IMAGE_H), gl.STATIC_DRAW, rtcPositionAttributeLocation, 2, gl.FLOAT);
  var rtcTexCoordBuffer = setVertexBuffer(texRectBuffer, gl.STATIC_DRAW, rtcTexCoordAttributeLocation, 2, gl.FLOAT);
}

function setupTransformFeedback() {
  // Create and fill out a transform feedback
  triTf = gl.createTransformFeedback();
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, triTf);

  // bind the buffers to the transform feedback
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, copyMutPositionBuffer);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, copyMutColorBuffer);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, copyMutMutatedPositionBuffer);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 3, copyMutMutatedColorBuffer);

  // Create and fill out a transform feedback
  copyMutTf = gl.createTransformFeedback();
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, copyMutTf);

  // bind the buffers to the transform feedback
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, triPositionBuffer);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, triColorBuffer);

  // unbind left over stuff

  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function renderTriangles() {
  // Tell it to use our program (pair of shaders)
  gl.useProgram(triProgram);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(triVao);

  // fb
  gl.bindFramebuffer(gl.FRAMEBUFFER, triangleFbo);

  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  var triMutIndex = Math.floor(Math.random() * N_TRIANGLES * 3);
  var triMutType = Math.floor(Math.random() * 6);
  var triMutNewVal = Math.random();

  gl.uniform2f(triResolutionUniformLocation, IMAGE_W, IMAGE_H);
  gl.uniform1i(triMutIndexUniformLocation, triMutIndex);
  gl.uniform1i(triMutTypeUniformLocation, triMutType);
  gl.uniform1f(triMutNewValUniformLocation, triMutNewVal);
  gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  // draw

  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, triTf);
  gl.beginTransformFeedback(gl.TRIANGLES);

  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = N_TRIANGLES * 3;
  gl.drawArrays(primitiveType, offset, count);

  gl.endTransformFeedback();
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function renderSimilarity() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, similarityFbo);

  gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Clear the canvas
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(similarityProgram);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(similarityVao);

  // Tell the shader to get the texture from texture unit 0
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, triangleTexture);
  gl.uniform1i(similarityTriangleImageLocation, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, targetImgTexture);
  gl.uniform1i(similarityTargetImageLocation, 1);

  //gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.uniform2f(similarityResolutionLocation, IMAGE_W, IMAGE_H);
  gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Draw the rectangle.
  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = 6;
  gl.drawArrays(primitiveType, offset, count);




  // gl.readBuffer(gl.COLOR_ATTACHMENT0);

  // const data = new Float32Array(IMAGE_W * IMAGE_H * 4);
  // gl.readPixels(
  //   0,            // x
  //   0,            // y
  //   IMAGE_W,                 // width
  //   IMAGE_H,                 // height
  //   gl.RGBA,           // format
  //   gl.FLOAT,  // type
  //   data);             // typed array to hold result

  // var sum = 0;
  // for (var i = 0; i < IMAGE_W * IMAGE_H; i++) {
  //   sum += data[i * 4];
  // }

  // console.log("cpu: " + sum);





  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function renderSumSimilarity() {
  var resX = IMAGE_W;
  var resY = IMAGE_H;

  // console.log("imw: " + resX + ", imh: " + resY);


  for (var i = 0; i < sumSimilarityMaxLvl; i++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, sumSimilarityFbo[i]);

    // Tell it to use our program (pair of shaders)
    gl.useProgram(sumSimilarityProgram);

    // Bind the attribute/buffer set we want.
    gl.bindVertexArray(sumSimilarityVao[i]);

    // Tell the shader to get the texture from texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, (i == 0) ? similarityTexture : sumSimilarityTexture[i - 1]);

    gl.uniform1i(sumSimilaritySrcImageLocation, 0);

    gl.uniform2f(sumSimilaritySrcResolutionLocation, resX, resY);

    resX = Math.ceil(resX / 4);
    resY = Math.ceil(resY / 4);

    gl.uniform2f(sumSimilarityDstResolutionLocation, resX, resY);

    gl.viewport(0, 0, resX, resY);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the rectangle.
    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = 6;
    gl.drawArrays(primitiveType, offset, count);

    // gl.readBuffer(gl.COLOR_ATTACHMENT0);

    // const data = new Float32Array(4 * resX * resY);
    // gl.readPixels(
    //   0,            // x
    //   0,            // y
    //   resX,                 // width
    //   resY,                 // height
    //   gl.RGBA,           // format
    //   gl.FLOAT,  // type
    //   data);             // typed array to hold result

    // var sum = 0.0;

    // for (var j = 0; j < resX * resY; j++) {
    //   sum += data[j * 4];
    // }

    // console.log("x: " + resX + ", y: " + resY);
    // console.log("sumsim sum: " + sum);
  }

  // gl.readBuffer(gl.COLOR_ATTACHMENT0);

  // const data = new Float32Array(4);
  // gl.readPixels(
  //   0,            // x
  //   0,            // y
  //   1,                 // width
  //   1,                 // height
  //   gl.RGBA,           // format
  //   gl.FLOAT,  // type
  //   data);             // typed array to hold result


  // console.log("sumsim sum: " + data[0]);
  // if (prevbest > data[0]) {
  //   console.error("Previous similarity was higher than the new one");
  // }
  // prevbest = data[0];




  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function renderCopyMut() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(copyMutProgram);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(copyMutVao);

  // Tell the shader to get the texture from texture unit 0
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sumSimilarityTexture[sumSimilarityMaxLvl - 1]);

  gl.uniform1i(copyMutSimilarityImageLocation, 0);

  // Tell the shader to get the texture from texture unit 0
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, bestSimilarityTexture[1 - copyBestCurrent]);

  gl.uniform1i(copyMutMaxSimilarityImageLocation, 1);

  // no need to call the fragment shader
  gl.enable(gl.RASTERIZER_DISCARD);

  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, copyMutTf);
  gl.beginTransformFeedback(gl.TRIANGLES);

  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = N_TRIANGLES * 3;
  gl.drawArrays(primitiveType, offset, count);

  gl.endTransformFeedback();
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

  // turn on using fragment shaders again
  gl.disable(gl.RASTERIZER_DISCARD);
}

function renderCopyBest() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, copyBestFbo[copyBestCurrent]);

  gl.viewport(0, 0, 1, 1);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(copyBestProgram);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(copyBestVao);

  // Tell the shader to get the texture from texture unit 0
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sumSimilarityTexture[sumSimilarityMaxLvl - 1]);

  gl.uniform1i(copyBestSimilarityImageLocation, 0);

  // Tell the shader to get the texture from texture unit 0
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, bestSimilarityTexture[1 - copyBestCurrent]);

  gl.uniform1i(copyBestMaxSimilarityImageLocation, 1);

  gl.uniform2f(copyBestResolutionLocation, 1, 1);
  gl.viewport(0, 0, 1, 1);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Draw the rectangle.
  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = 6;
  gl.drawArrays(primitiveType, offset, count);

  copyBestCurrent = 1 - copyBestCurrent;



  // gl.readBuffer(gl.COLOR_ATTACHMENT0);

  // const data = new Float32Array(4);
  // gl.readPixels(
  //   0,            // x
  //   0,            // y
  //   1,                 // width
  //   1,                 // height
  //   gl.RGBA,           // format
  //   gl.FLOAT,  // type
  //   data);             // typed array to hold result


  // console.log("best val: " + data[0]);
  // if (prevbest > data[0]) {
  //   console.error("Previous similarity was higher than the new one");
  // }
  // prevbest = data[0];




  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function renderToCanvas() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Clear the canvas
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(rtcProgram);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(rtcVao);

  // Tell the shader to get the texture from texture unit 0
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, triangleTexture);
  gl.uniform1i(rtcImageLocation, 0);
  gl.uniform2f(rtcResolutionLocation, IMAGE_W, IMAGE_H);
  gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Draw the rectangle.
  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = 6;
  gl.drawArrays(primitiveType, offset, count);
}

function render() {
  // Get A WebGL context
  gl = canvas.getContext("webgl2", {
    //antialias: false,
    //alpha: false,
    premultipliedAlpha: false  // Ask for non-premultiplied alpha
  });
  if (!gl) {
    console.error("WebGL 2 not available");
    return;
  }

  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  //gl.disable(gl.DEPTH_TEST);

  if (!gl.getExtension("EXT_color_buffer_float")) {
    console.error("EXT_color_buffer_float not available");
  }
  if (!gl.getExtension("OES_texture_float_linear")) {
    console.error("OES_texture_float_linear not available");
  }

  setupTextures();
  setupFrameBuffers();

  setupTriProgram();
  setupSimilarityProgram();
  setupSumSimilarityProgram();
  setupCopyMutProgram();
  setupCopyBestProgram();
  setupRenderToCanvasProgram();
  setupTransformFeedback();

  requestAnimationFrame(renderLoop)
}

function renderLoop(now) {
  for (var i = 0; i < iterationsPerFrame; i++) {
    renderTriangles();
    renderSimilarity();
    renderSumSimilarity();
    renderCopyMut();
    renderCopyBest();

    gl.flush();
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  renderToCanvas();

  updateTotalIterationsText();
  updateIPS(now);

  //return;

  animationFrame = requestAnimationFrame(renderLoop);
}

function stopRender() {
  cancelAnimationFrame(animationFrame);
}

function updateIPS(now) {
  var deltaTime = now - animationFramePrevTime;
  elapsedIterations += iterationsPerFrame;

  if (deltaTime > 1000) {
    animationFramePrevTime = now;

    var ipsText = parseInt(elapsedIterations / (deltaTime * 0.001)) + " iterations/s";
    elapsedIterations = 0;

    ipsElem.textContent = ipsText;
  }
}

function updateTotalIterationsText() {
  totalIterations += iterationsPerFrame;
  totalItElem.textContent = totalIterations + " total iterations";
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