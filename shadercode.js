"use strict";

var imgVertexShaderSource = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;

uniform vec2 u_resolution;

out vec2 v_texCoord;

void main() {

  // convert the position from pixels to clip space
  vec2 clipSpace = (a_position / u_resolution) * 2.0 -1.0;

  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

  v_texCoord = a_texCoord;
}
`;

var imgFragmentShaderSource = `#version 300 es
precision highp float;

uniform sampler2D u_image;

in vec2 v_texCoord;

out vec4 outColor;

void main() {
  outColor = texture(u_image, v_texCoord);
}
`;

var triVertexShaderSource = `#version 300 es
in vec2 a_position;
in vec4 a_color;

uniform vec2 u_resolution;

out vec4 v_color;

void main() {

  // convert the position from pixels to clip space
  vec2 clipSpace = (a_position / u_resolution) * 2.0 -1.0;

  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  v_color = a_color;
}
`;

var triFragmentShaderSource = `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 outColor;

void main() {
  outColor = v_color;
}
`;