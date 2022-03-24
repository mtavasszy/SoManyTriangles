"use strict";

// program variables //
var TARGET_IMAGE = new Image();
var IMAGE_W = 0;
var IMAGE_H = 0;

var canvas = 0;
var gl = 0;

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

  canvas = document.querySelector("#canvas_best");
  canvas.width = IMAGE_W;
  canvas.height = IMAGE_H;
}

function renderBestImage() {
  // Get A WebGL context
  canvas = document.querySelector("#canvas_best");
  gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false  // Ask for non-premultiplied alpha
  });
  if (!gl) {
    return;
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);

  twgl.setAttributePrefix("a_");

  // buffers
  var positions = [];
  for (let i = 0; i < N_TRIANGLES * 3; i++) {
    positions.push(Math.random() * IMAGE_W);  // random x
    positions.push(Math.random() * IMAGE_H);  // random y
  }

  var colors = [];
  for (let i = 0; i < N_TRIANGLES; i++) {
    var r = Math.random();
    var g = Math.random();
    var b = Math.random();
    var a = Math.random();

    for (let c = 0; c < 3; c++) {
      colors.push(r);
      colors.push(g);
      colors.push(b);
      colors.push(a);
    }
  }

  var arrays = {
    position: { numComponents: 2, data: positions, },
    color: { numComponents: 4, data: colors, },
  };
  var bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  // program
  var programInfo = twgl.createProgramInfo(gl, [triangleVertexShaderSource, triangleFragmentShaderSource]);

  var vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);

  var uniforms = {
    u_resolution: [IMAGE_W, IMAGE_H],
  };

  gl.viewport(0, 0, IMAGE_W, IMAGE_H);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(programInfo.program);

  // Setup all the needed attributes.
  gl.bindVertexArray(vao);

  // Set the uniforms that are the same for all objects.
  twgl.setUniforms(programInfo, uniforms);

  // draw
  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = N_TRIANGLES;
  gl.drawArrays(primitiveType, offset, count);

}