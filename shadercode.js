"use strict";

var vertexShaderSource = `#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec2 a_position;
in vec2 a_texCoord;

// Used to pass in the resolution of the canvas
uniform vec2 u_resolution;

// Used to pass the texture coordinates to the fragment shader
out vec2 v_texCoord;

// all shaders have a main function
void main() {

  // convert the position from pixels to 0.0 to 1.0
  vec2 zeroToOne = a_position / u_resolution;

  // convert from 0->1 to 0->2
  vec2 zeroToTwo = zeroToOne * 2.0;

  // convert from 0->2 to -1->+1 (clipspace)
  vec2 clipSpace = zeroToTwo - 1.0;

  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

  // pass the texCoord to the fragment shader
  // The GPU will interpolate this value between points.
  v_texCoord = a_texCoord;
}
`;

var fragmentShaderSource = `#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

// our texture
uniform sampler2D u_image;

// the texCoords passed in from the vertex shader.
in vec2 v_texCoord;

// we need to declare an output for the fragment shader
out vec4 outColor;

void main() {
  outColor = texture(u_image, v_texCoord);
}
`;