import * as THREE from 'three';

export interface StudioHandMaterialOptions {
  baseColor?: string;
  emissiveColor?: string;
  rimColor?: string;
  opacity?: number;
  fresnelPower?: number;
  fresnelStrength?: number;
  rimAlphaBoost?: number;
}

/**
 * Translucent studio hand material with elevated physical clearcoat + custom view-space
 * Fresnel edge rim so fingers & knuckles remain razor-readable over bright brass, mirror
 * chrome, and glowing capacitive touch pads while keeping `depthWrite: false` (zero sorting artifacts).
 */
export function createStudioHandMaterial({
  baseColor = '#efe4d6',
  emissiveColor = '#4c3b2b',
  rimColor = '#fff2dd',
  opacity = 0.25,
  fresnelPower = 2.45,
  fresnelStrength = 0.68,
  rimAlphaBoost = 0.48,
}: StudioHandMaterialOptions = {}): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(baseColor),
    emissive: new THREE.Color(emissiveColor),
    emissiveIntensity: 0.16,
    roughness: 0.2,
    metalness: 0.04,
    transparent: true,
    opacity,
    clearcoat: 0.96,
    clearcoatRoughness: 0.12,
    sheen: 0.5,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color(rimColor),
    depthWrite: false,
  });

  const rimVec = new THREE.Color(rimColor);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFresnelColor = { value: rimVec };
    shader.uniforms.uFresnelPower = { value: fresnelPower };
    shader.uniforms.uFresnelStrength = { value: fresnelStrength };
    shader.uniforms.uRimAlphaBoost = { value: rimAlphaBoost };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uFresnelColor;
uniform float uFresnelPower;
uniform float uFresnelStrength;
uniform float uRimAlphaBoost;`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 fNorm = normalize( vNormal );
vec3 fView = normalize( vViewPosition );
float fresnelTerm = pow( 1.0 - clamp( abs( dot( fNorm, fView ) ), 0.0, 1.0 ), uFresnelPower );
gl_FragColor.rgb += uFresnelColor * fresnelTerm * uFresnelStrength;
gl_FragColor.a = clamp( gl_FragColor.a + fresnelTerm * uRimAlphaBoost, 0.0, 0.9 );
#include <dithering_fragment>`
      );
  };

  mat.customProgramCacheKey = () =>
    `studio-hand-fresnel-v1-${rimColor}-${fresnelPower}-${fresnelStrength}-${rimAlphaBoost}`;

  return mat;
}
