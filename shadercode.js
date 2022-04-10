"use strict";

var rtcVertSource = `#version 300 es
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

var rtcFragSource = `#version 300 es
precision highp float;

uniform sampler2D u_image;

in vec2 v_texCoord;

out vec4 outColor;

void main() {
  outColor = texture(u_image, v_texCoord);
}
`;

var similarityVertSource = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;

uniform vec2 u_resolution;

out vec2 v_texCoord;

void main() {

  // convert the position from pixels to clip space
  vec2 clipSpace = (a_position / u_resolution) * 2.0 -1.0;

  gl_Position = vec4(clipSpace, 0, 1);

  v_texCoord = a_texCoord;
}
`;

var similarityFragSource = `#version 300 es
precision highp float;

uniform sampler2D u_targetImage;
uniform sampler2D u_triangleImage;

in vec2 v_texCoord;

out vec4 outColor;

void main() {
  vec4 targetCol = texture(u_targetImage, v_texCoord);
  vec4 triangleCol = texture(u_triangleImage, v_texCoord);

  vec3 diff = abs(targetCol.xyz * targetCol.w - triangleCol.xyz * triangleCol.w);

  float similarity = 1.0 - (diff.x + diff.y + diff.z) * 0.3333; 

  outColor = vec4(similarity, 0.0, 0.0, 1.0);
}
`;

var renderTriVertSource = `#version 300 es
in vec2 a_position;
in vec4 a_color;

uniform vec2 u_resolution;
uniform int u_mutIndex; // index of mutated vertex
uniform int u_mutAttrType; // rgba (0-3) or xy (4-5)
uniform float u_mutNewVal; 

out vec2 tf_position;
out vec4 tf_color;
out vec2 tf_mutated_position;
out vec4 tf_mutated_color;

out vec4 v_color;

void main() {
  int tri_i = gl_VertexID / 3;
  int triMut_i = u_mutIndex / 3;

  bool isColRMut = (triMut_i == tri_i && u_mutAttrType == 0) ? true : false; 
  bool isColGMut = (triMut_i == tri_i && u_mutAttrType == 1) ? true : false; 
  bool isColBMut = (triMut_i == tri_i && u_mutAttrType == 2) ? true : false; 
  bool isColAMut = (triMut_i == tri_i && u_mutAttrType == 3) ? true : false; 
  bool isPosXMut = (u_mutIndex == gl_VertexID && u_mutAttrType == 4) ? true : false; 
  bool isPosYMut = (u_mutIndex == gl_VertexID && u_mutAttrType == 5) ? true : false; 

  vec2 pos = vec2(isPosXMut ? u_mutNewVal * u_resolution.x : a_position.x, isPosYMut ? u_mutNewVal * u_resolution.y : a_position.y);
  vec4 col = vec4(isColRMut ? u_mutNewVal : a_color.r, isColGMut ? u_mutNewVal : a_color.g, isColBMut ? u_mutNewVal : a_color.b, isColAMut ? u_mutNewVal : a_color.a);

  // convert the position from pixels to clip space
  vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;

  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  v_color = col;

  tf_position = a_position;
  tf_color = a_color;
  tf_mutated_position = pos;
  tf_mutated_color = col;
}
`;

var renderTriFragSource = `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 outColor;

void main() {
  outColor = v_color;
}
`;

var copyBestVertSource = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;

uniform vec2 u_resolution;

out vec2 v_texCoord;

void main() {

  // convert the position from pixels to clip space
  vec2 clipSpace = (a_position / u_resolution) * 2.0 -1.0;

  gl_Position = vec4(clipSpace, 0, 1);

  v_texCoord = a_texCoord;
}
`;

var copyBestFragSource = `#version 300 es
precision highp float;

uniform sampler2D u_similarityImage;
uniform sampler2D u_maxSimilarityImage;
uniform float u_maxMipLvl;

in vec2 v_texCoord;

out vec4 outColor;

void main() {
  float maxVal = max(textureLod(u_similarityImage, vec2(0.5f, 0.5f), u_maxMipLvl).x, texture(u_maxSimilarityImage, vec2(0.5f, 0.5f)).x);
  outColor = vec4(maxVal, 0.0, 0.0, 1.0);
}
`;

var copyMutationVertSource = `#version 300 es
in vec2 a_position;
in vec4 a_color;
in vec2 a_mutated_position;
in vec4 a_mutated_color;

uniform sampler2D u_similarityImage;
uniform sampler2D u_maxSimilarityImage;
uniform float u_maxMipLvl;

out vec2 tf_position;
out vec4 tf_color;

void main() {
  float mutatedSimilarity = textureLod(u_similarityImage, vec2(0.5f, 0.5f), u_maxMipLvl).x;
  float bestSimilarity = texture(u_maxSimilarityImage, vec2(0.5f, 0.5f)).x;

  bool isBetter = mutatedSimilarity > bestSimilarity;

  tf_position = isBetter ? a_mutated_position : a_position;
  tf_color = isBetter ? a_mutated_color : a_color;
}
`;

var copyMutationFragSource = `#version 300 es
precision highp float;
void main() {
}
`;