import { Color, Matrix4, NoColorSpace, ShaderMaterial,
  Vector2, Vector3, Vector4, type Texture } from "three";

export type ToonEnvironment =
  | { kind: "rigid-reflection"; origin: [number, number, number] }
  | { kind: "normal-projection" }
  | { kind: string; origin?: [number, number, number] };

/** Builds the KartRider mode1/key2 shader with exact palette and UV behavior. */
export function createToonEnvironmentMaterial(baseMap: Texture,
  environment: ToonEnvironment, paletteParts = 0): ShaderMaterial {
  baseMap.colorSpace = NoColorSpace;
  const reflectionOrigin = environment.kind === "rigid-reflection"
    ? environment.origin! : [0, 0, 0];
  const partUniforms = paletteParts > 0 ? `
      attribute float aPartIndex;
      // Four vec4 columns per part: the array holds paletteParts * 4 entries.
      uniform vec4 uPartPalette[${paletteParts * 4}];
    ` : "";
  const partTransform = paletteParts > 0 ? `
        int partIndex = int(aPartIndex + 0.5);
        mat4 partMatrix = mat4(
          uPartPalette[partIndex * 4],
          uPartPalette[partIndex * 4 + 1],
          uPartPalette[partIndex * 4 + 2],
          uPartPalette[partIndex * 4 + 3]);
        vec3 shadedPosition = (partMatrix * vec4(position, 1.0)).xyz;
        vec3 shadedNormal = mat3(partMatrix) * normal;
    ` : `
        vec3 shadedPosition = position;
        vec3 shadedNormal = normal;
    `;
  const material = new ShaderMaterial({
    name: "KartRider Toon mode1/key2",
    uniforms: {
      baseMap: { value: baseMap },
      toonEnv: { value: null },
      clientWorld: { value: new Matrix4() },
      clientWorldInverse: { value: new Matrix4() },
      viewOriginClient: { value: new Vector3() },
      reflectionOriginObject: { value: new Vector3(...reflectionOrigin) },
      normalProjectionEnabled: { value: environment.kind === "normal-projection" ? 1 : 0 },
      normalUvOffset: { value: new Vector2() },
      reflectionUvOffset: { value: new Vector2() },
      environmentAddSigned: { value: environment.kind === "rigid-reflection" ? 1 : 0 },
      alphaTestEnabled: { value: 0 },
      alphaFunction: { value: 8 },
      alphaReference: { value: 0 },
      uvControllerEnabled: { value: 0 },
      uvOffsetScale: { value: new Vector4(0, 0, 1, 1) },
      uvRotation: { value: 0 },
      fogColor: { value: new Color() },
      fogNear: { value: 1 },
      fogFar: { value: 1 },
      fogDensity: { value: 0.00025 },
      ...(paletteParts > 0
        ? { uPartPalette: { value: new Float32Array(paletteParts * 16) } } : {}),
    },
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv0;
      varying vec2 vUv1;
      uniform mat4 clientWorld;
      uniform mat4 clientWorldInverse;
      uniform vec3 viewOriginClient;
      uniform vec3 reflectionOriginObject;
      uniform int normalProjectionEnabled;
      uniform vec2 normalUvOffset;
      uniform vec2 reflectionUvOffset;
      uniform int uvControllerEnabled;
      uniform vec4 uvOffsetScale;
      uniform float uvRotation;
      ${partUniforms}

      void main() {
        if (uvControllerEnabled != 0) {
          float cosine = cos(uvRotation);
          float sine = sin(uvRotation);
          float x = uv.x - 0.5 - uvOffsetScale.x;
          float y = uv.y - 0.5 - uvOffsetScale.y;
          vUv0 = vec2(
            0.5 + cosine * uvOffsetScale.z * x - sine * uvOffsetScale.w * y,
            0.5 - sine * uvOffsetScale.z * x - cosine * uvOffsetScale.w * y
          );
        } else {
          vUv0 = uv;
        }
        ${partTransform}

        if (normalProjectionEnabled != 0) {
          // P3528 uses the draw matrix row directly; it does not use an inverse-transpose normal matrix.
          vec3 direction = -vec3(clientWorld[0][2], clientWorld[1][2], clientWorld[2][2]) /
            length(clientWorld[0].xyz);
          vUv1 = vec2(0.3 * (dot(shadedNormal, direction) + normalUvOffset.x), normalUvOffset.y);
        } else {
          vec3 eyeObject = (clientWorldInverse * vec4(viewOriginClient, 1.0)).xyz;
          vec3 incidentDelta = reflectionOriginObject - eyeObject;
          float incidentLength = length(incidentDelta);
          // Native uses this exact fallback only for a strict zero length; NaN still propagates.
          vec3 incidentObject = incidentLength == 0.0 ? vec3(1.0) : incidentDelta / incidentLength;
          vec3 reflectedObject = incidentObject - 2.0 * dot(shadedNormal, incidentObject) * shadedNormal;
          vec3 reflectedClient = (clientWorld * vec4(reflectedObject, 0.0)).xyz;
          vUv1 = 0.5 * (reflectedClient.xy + vec2(1.0)) + reflectionUvOffset;
        }
        vec4 mvPosition = modelViewMatrix * vec4(shadedPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>
      varying vec2 vUv0;
      varying vec2 vUv1;
      uniform sampler2D baseMap;
      uniform sampler2D toonEnv;
      uniform int environmentAddSigned;
      uniform int alphaTestEnabled;
      uniform int alphaFunction;
      uniform float alphaReference;

      bool alphaPass(float value) {
        if (alphaFunction == 1) return false;
        if (alphaFunction == 2) return value < alphaReference;
        if (alphaFunction == 3) return value == alphaReference;
        if (alphaFunction == 4) return value <= alphaReference;
        if (alphaFunction == 5) return value > alphaReference;
        if (alphaFunction == 6) return value != alphaReference;
        if (alphaFunction == 7) return value >= alphaReference;
        return true;
      }

      void main() {
        vec4 stage0 = texture2D(baseMap, vUv0);
        vec4 env = texture2D(toonEnv, vUv1);
        if (environmentAddSigned == 0) {
          // Current selector 0 reads ToonProperty.word1=4: MODULATE for color and alpha.
          gl_FragColor = stage0 * env;
        } else {
          // Selector 1 uses ADDSIGNED color and keeps CURRENT alpha.
          gl_FragColor = vec4(
            clamp(stage0.rgb + env.rgb - vec3(0.5), vec3(0.0), vec3(1.0)),
            stage0.a
          );
        }
        if (alphaTestEnabled != 0 && !alphaPass(gl_FragColor.a)) discard;
        #include <fog_fragment>
      }
    `,
  });
  material.toneMapped = false;
  material.fog = true;
  material.forceSinglePass = true;
  return material;
}
