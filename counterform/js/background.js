const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance"
});

class RingBuffer
{
    constructor(size)
    {
        this.data = new Float32Array(size);
        this.size = size;
        this.index = 0;
        this.count = 0;
        this.sum = 0;
    }

    push(value)
    {
        if (this.count < this.size)
        {
            this.sum += value;
            this.data[this.index] = value;
            this.count++;
        }
        else
        {
            this.sum += value - this.data[this.index];
            this.data[this.index] = value;
        }

        this.index = (this.index + 1) % this.size;
    }

    average()
    {
        return this.count === 0 ? 0 : this.sum / this.count;
    }
};

const UPDATE_VERTEX_SHADER = `#version 300 es

layout(location = 0) in vec2 a_Position;
layout(location = 1) in vec2 a_Velocity;
layout(location = 2) in float a_Age;

out vec2 v_Position;
out vec2 v_Velocity;
out float v_Age;

uniform float u_Time;
uniform float u_Dt;
uniform vec2 u_Bounds;
uniform int u_Pattern;
uniform float u_FieldScale;
uniform float u_Smoothing;
uniform float u_Speed;

float hash11(float p)
{
    p = fract(p * 0.1031F);
    p *= p + 33.33F;
    p *= p + p;

    return fract(p);
}

vec2 hash21(float p)
{
    vec3 p3 = fract(vec3(p) * vec3(0.1031F, 0.1030F, 0.0973F));
    p3 += dot(p3, p3.yzx + 33.33F);

    return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v)
{
    const vec4 C = vec4(0.211324865405187F, 0.366025403784439F, -0.577350269189626F, 0.024390243902439F);

    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0F, 0.0F) : vec2(0.0F, 1.0F);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);

    vec3 p = permute(permute(i.y + vec3(0.0F, i1.y, 1.0F)) + i.x + vec3(0.0F, i1.x, 1.0F));
    vec3 m = max(0.5F - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0F);
    m = m * m;
    m = m * m;

    vec3 x = 2.0F * fract(p * C.www) - 1.0F;
    vec3 h = abs(x) - 0.5F;
    vec3 ox = floor(x + 0.5F);
    vec3 a0 = x - ox;

    m *= 1.79284291400159F - 0.85373472095314F * (a0 * a0 + h * h);

    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;

    return 130.0F * dot(m, g);
}

float fbm(vec2 p)
{
    float value = 0.0F;
    float amplitude = 0.5F;
    float frequency = 1.0F;

    for (uint i = 0U; i < 4U; i++)
    {
        value += amplitude * snoise(p * frequency);
        frequency *= 2.0F;
        amplitude *= 0.5F;
    }

    return value;
}

float fbm(vec2 p, float t)
{
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (uint i = 0u; i < 4u; ++i)
    {
        vec2 offset = vec2(
            cos(t * 0.15 + float(i) * 13.7),
            sin(t * 0.15 + float(i) * 9.2)
        );

        value += amplitude * snoise(p * frequency + offset * 10.0);

        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

const float TAU = 6.28318530718F;

vec2 fieldDirection(int type, vec2 position)
{
    switch (u_Pattern)
    {
        case 0:
        {
            float angle = fbm(position * u_FieldScale, u_Time) * TAU * 2.0F;

            return vec2(cos(angle), sin(angle));
        }

        case 1:
        {
            vec2 q = vec2(fbm(position * u_FieldScale + vec2(1.7F, 9.2F)), fbm(position * u_FieldScale + vec2(8.3F, 2.8F)));
            float angle = fbm(position * u_FieldScale + q * 1.5F + u_Time * 0.1F) * TAU;

            return vec2(cos(angle), sin(angle));
        }

        case 2:
        {
            vec2 toP = position - vec2(0.0F);
            float d = length(toP) + 0.0001F;
            float angle = atan(toP.y, toP.x) + u_Time * 0.15F - d * 2.5F + fbm(position * u_FieldScale * 0.3F) * 1.0F;

            return vec2(cos(angle), sin(angle)) * mix(0.3F, 1.0F, smoothstep(0.0F, 1.2F, d));
        }
    }
}

void main()
{
    vec2 position = a_Position;
    vec2 velocity = a_Velocity;
    float age = a_Age + u_Dt;

    // vec2 q = vec2(fbm(position * u_FieldScale + vec2(1.7F, 9.2F)), fbm(position * u_FieldScale + vec2(8.3F, 2.8F)));
    // float angle = fbm(position * u_FieldScale + q * 1.5F + u_Time * 0.1F) * TAU;

    // vec2 targetVelocity = vec2(cos(angle), sin(angle)) * u_Speed;

    vec2 targetVelocity = fieldDirection(u_Pattern, position) * u_Speed;
    // vec2 targetVelocity = vec2(0.0F, 0.0F);
    velocity = mix(targetVelocity, velocity, u_Smoothing);
    position += velocity * u_Dt;

    bool outOfBounds = (abs(position.x) > u_Bounds.x) || (abs(position.y) > u_Bounds.y);

    if (outOfBounds || (age > 4.0F))
    {
        position = (hash21(float(gl_VertexID) * 0.0001F + u_Time * 170.13F) * 2.0F - 1.0F) * u_Bounds;
        velocity = vec2(0.0F);
        // velocity = vec2(hash11(u_Time) * 0.08F, 1.0F * max(0.01F, hash11(u_Time)));
        age = hash11(float(gl_VertexID) + u_Time) * 0.05F;
    }

    v_Position = position;
    v_Velocity = velocity;
    v_Age = age;
}
`

const UPDATE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 o_Color;

void main()
{
    o_Color = vec4(0.0F);
}
`

const RENDER_VERTEX_SHADER = `#version 300 es

layout(location = 0) in vec2 a_Position;
layout(location = 1) in vec2 a_Velocity;
layout(location = 2) in float a_Age;

out vec4 v_Color;

uniform float u_Time;
uniform vec2 u_Bounds;
uniform float u_MaxAge;
uniform float u_MaxSpeed;
uniform float u_PointSize;
uniform vec3 u_BaseColor;
uniform float u_Alpha;

vec3 hsv2rgb(vec3 color)
{
  vec4 K = vec4(1.0, 2.0F / 3.0F, 1.0 / 3.0F, 3.0F);
  vec3 p = abs(fract(color.xxx + K.xyz) * 6.0F - K.www);

  return color.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0F), color.y);
}

void main()
{
    vec2 clip = a_Position / u_Bounds;

    float speed = length(a_Velocity);
    float speedRatio = clamp(speed / u_MaxSpeed, 0.0F, 1.0F);

    gl_PointSize = u_PointSize * mix(0.6F, 1.4F, speedRatio);

    gl_Position = vec4(clip, 0.0F, 1.0F);

    float lifeRatio = clamp(a_Age / u_MaxAge, 0.0F, 1.0F);
    float fadeIn = smoothstep(0.0F, 0.2F, lifeRatio);
    float fadeOut = 1.0F - smoothstep(0.8F, 1.0F, lifeRatio);
    float alpha = fadeIn * fadeOut * u_Alpha;

    v_Color = vec4(u_BaseColor * mix(0.5F, 1.0F, speedRatio), alpha);
}
`;

const RENDER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_Color;

out vec4 o_Color;

void main()
{
    // vec2 toCircleCenter = vec2(0.5F, 0.5F) - gl_PointCoord;
    // float distanceToCenterSquare = dot(toCircleCenter, toCircleCenter);

    // if (distanceToCenterSquare > 0.5F * 0.5F)
    // {
    //     discard;
    // }

    // float falloff = smoothstep(0.5F, 0.45F, sqrt(distanceToCenterSquare));

    vec2 c = gl_PointCoord - vec2(0.5F);
    float d = length(c);

    if (d > 0.5F)
    {
        discard;
    }

    float falloff = smoothstep(0.5F, 0.0F, d);

    o_Color = vec4(v_Color.rgb * falloff * v_Color.a, 1.0F);
    // o_Color = vec4(1.0F) * 0.05F;
}
`;

const FULLSCREEN_VERTEX_SHADER =` #version 300 es
out vec2 v_UV;

void main()
{
    vec2 position = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);

    v_UV = position;

    gl_Position = vec4(position * 2.0F - 1.0F, 0.0F, 1.0F);
}
`;

const FADE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_UV;

uniform sampler2D u_Texture;

out vec4 o_Color;

uniform float u_Decay;

void main()
{
    vec4 textureColor = texture(u_Texture, v_UV);

    textureColor *= exp(-u_Decay * 0.01333333333333F);

    o_Color = max(textureColor - 0.01333333333333F * 0.4F, 0.0F);

    // o_Color = textureColor * u_Decay;
}
`;

const COPY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_UV;

uniform sampler2D u_Texture;

out vec4 o_Color;

void main()
{
    // o_Color = vec4(v_UV, 0.0F, 1.0F);
    o_Color = texture(u_Texture, v_UV);
}
`;

function compileShader(type, source)
{
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    {
        const info = gl.getShaderInfoLog(shader);

        gl.deleteShader(shader);

        throw new Error("Shader compile error: " + info);
    }

    return shader;
}

function linkProgram(vertexShaderSource, fragmentShaderSource, transformFeedbackVaryings)
{
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    if (transformFeedbackVaryings)
    {
        gl.transformFeedbackVaryings(program, transformFeedbackVaryings, gl.INTERLEAVED_ATTRIBS);
    }

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
        const info = gl.getProgramInfoLog(program);

        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        gl.deleteProgram(program);

        throw new Error("Program link error: " + info);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
}

class Program
{
    constructor(vertexShaderSource, fragmentShaderSource, transformFeedbackVaryings)
    {
        this.handle = linkProgram(vertexShaderSource, fragmentShaderSource, transformFeedbackVaryings);

        this.uniformLocations = new Map();
        this.uniformCache = new Map();
    }

    use()
    {
        gl.useProgram(this.handle);
    }

    uniformLocation(name)
    {
        let location = this.uniformLocations.get(name);

        if (location === undefined)
        {
            location = gl.getUniformLocation(this.handle, name);

            this.uniformLocations.set(name, location);
        }

        return location;
    }

    setInt(name, value)
    {
        if (this.uniformCache.get(name) === value)
        {
            return;
        }

        this.uniformCache.set(name, value);

        gl.uniform1i(this.uniformLocation(name), value);
    }

    setFloat(name, value)
    {
        if (this.uniformCache.get(name) === value)
        {
            return;
        }

        this.uniformCache.set(name, value);

        gl.uniform1f(this.uniformLocation(name), value);
    }

    setFloat2(name, x, y)
    {
        const previous = this.uniformCache.get(name);

        if ((previous) && (previous[0] === x) && (previous[1] === y))
        {
            return;
        }

        this.uniformCache.set(name, [x, y]);

        gl.uniform2f(this.uniformLocation(name), x, y);
    }

    setFloat3(name, x, y, z)
    {
        const previous = this.uniformCache.get(name);

        if ((previous) && (previous[0] === x) && (previous[1] === y) && (previous[2] === z))
        {
            return;
        }

        this.uniformCache.set(name, [x, y, z]);

        gl.uniform3f(this.uniformLocation(name), x, y, z);
    }

    dispose()
    {
        gl.deleteProgram(this.handle);
    }
};

class TransformFeedbackSet
{
    constructor(capacity, attributes, seedFunction)
    {
        this.capacity = capacity;
        this.attributes = attributes;

        this.buffers = [gl.createBuffer(), gl.createBuffer()];
        this.currentBuffer = 0;

        this.vertexArrays = [gl.createVertexArray(), gl.createVertexArray()];

        this.transformFeedbacks = [gl.createTransformFeedback(), gl.createTransformFeedback()];

        this.allocate(seedFunction);
    }

    allocate(seedFunction)
    {
        const n = this.capacity;
        const attributes = this.attributes;
        const seedData = seedFunction(n);

        // Create/Upload vertex data
        for (let buffer = 0; buffer < 2; ++buffer)
        {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[buffer]);
            gl.bufferData(gl.ARRAY_BUFFER, seedData, gl.STATIC_DRAW);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Create/Configure vertex array layout
        let stride = 0;
        let offset = new Uint32Array(attributes.length);

        for (let attribute = 0; attribute < attributes.length; ++attribute)
        {
            const attributeSpecification = attributes[attribute];

            offset[attribute] = stride;
            stride += attributeSpecification.count * Float32Array.BYTES_PER_ELEMENT;
        }

        for (let buffer = 0; buffer < 2; ++buffer)
        {
            gl.bindVertexArray(this.vertexArrays[buffer]);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[buffer])

            for (let attribute = 0; attribute < attributes.length; ++attribute)
            {
                const attributeSpecification = attributes[attribute];

                gl.vertexAttribPointer(attributeSpecification.location, attributeSpecification.count, gl.FLOAT, false, stride, offset[attribute]);
                gl.enableVertexAttribArray(attributeSpecification.location);

                // console.log(`${attributeSpecification.name}: location - ${attributeSpecification.location}, count - ${attributeSpecification.count}, stride - ${stride}, offset - ${offset[attribute]}`);
            }
        }

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Setup transform feedbacks
        for (let buffer = 0; buffer < 2; ++buffer)
        {
            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedbacks[buffer]);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.buffers[buffer]);
        }

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    }

    step()
    {
        const readBuffer = this.currentBuffer;
        const writeBuffer = 1 - this.currentBuffer;

        gl.bindVertexArray(this.vertexArrays[readBuffer]);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedbacks[writeBuffer]);

        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, this.capacity);
        gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindVertexArray(null);

        this.currentBuffer = writeBuffer;
    }

    draw()
    {
        gl.bindVertexArray(this.vertexArrays[this.currentBuffer]);
        gl.drawArrays(gl.POINTS, 0, this.capacity);
        gl.bindVertexArray(null);
    }

    dispose()
    {
        for (let buffer = 0; buffer < 2; ++buffer)
        {
            gl.deleteBuffer(this.buffers[buffer]);
            gl.deleteVertexArray(this.vertexArrays[buffer]);
            gl.deleteTransformFeedback(this.transformFeedbacks[buffer]);
        }
    }
};

class PingPongTarget
{
    constructor(width, height)
    {
        this.framebuffers = [gl.createFramebuffer(), gl.createFramebuffer()];
        this.textures = [gl.createTexture(), gl.createTexture()];

        this.current = 0;

        this.width = width;
        this.height = height;

        this.resize(this.width, this.height);
    }

    resize(width, height)
    {
        this.width = width;
        this.height = height;

        for (let i = 0; i < 2; ++i)
        {
            gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[i], 0);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    clear()
    {
        for (let i = 0; i < 2; ++i)
        {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    getReadTexture()
    {
        return this.textures[this.current];
    }

    getWriteFramebuffer()
    {
        return this.framebuffers[1 - this.current];
    }

    swap()
    {
        this.current = 1 - this.current;
    }

    dispose()
    {
        for (let i = 0; i < 2; ++i)
        {
            gl.deleteTexture(this.textures[i]);
            gl.deleteFramebuffer(this.framebuffers[i]);
        }
    }
};

class SimulationPass
{
    constructor(program)
    {
        this.program = program;
    }

    execute(context)
    {
        this.program.use();
        this.program.setFloat("u_Time", context.time);
        this.program.setFloat("u_Dt", context.dt);
        this.program.setFloat2("u_Bounds", context.bounds[0], context.bounds[1]);
        this.program.setInt("u_Pattern", context.state.pattern);
        this.program.setFloat("u_FieldScale", context.state.fieldScale);
        this.program.setFloat("u_Smoothing", context.state.smoothing);
        this.program.setFloat("u_Speed", context.state.maxSpeed);

        context.particleSystem.step();
    }
};

class TrailPass
{
    constructor(fadeProgram, particleProgram)
    {
        this.fadeProgram = fadeProgram;
        this.particleProgram = particleProgram;
    }

    execute(context)
    {
        gl.bindFramebuffer(gl.FRAMEBUFFER, context.pingPongTarget.getWriteFramebuffer());
        gl.viewport(0, 0, context.pingPongTarget.width, context.pingPongTarget.height);

        this.fadeProgram.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, context.pingPongTarget.getReadTexture());
        this.fadeProgram.setInt("u_Texture", 0);
        this.fadeProgram.setFloat("u_Decay", context.state.decay);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);

        this.particleProgram.use();
        this.particleProgram.setFloat("u_Time", context.time);
        this.particleProgram.setFloat2("u_Bounds", context.bounds[0], context.bounds[1]);
        this.particleProgram.setFloat("u_MaxAge", context.state.maxAge);
        this.particleProgram.setFloat("u_MaxSpeed", context.state.maxSpeed);
        this.particleProgram.setFloat("u_PointSize", context.state.pointSize * context.dpr);
        this.particleProgram.setFloat3("u_BaseColor", context.state.baseColor[0], context.state.baseColor[1], context.state.baseColor[2]);
        this.particleProgram.setFloat("u_Alpha", context.state.alpha);
        context.particleSystem.draw();

        gl.disable(gl.BLEND);

        context.pingPongTarget.swap();
    }
};

class CompositePass
{
    constructor(program)
    {
        this.program = program;
    }

    execute(context)
    {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, context.pingPongTarget.width, context.pingPongTarget.height);

        this.program.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, context.pingPongTarget.getReadTexture());
        this.program.setInt("u_Texture", 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
};

class Renderer
{
    constructor()
    {
        this.entries = [];
    }

    addPass(pass, condition)
    {
        this.entries.push({ pass, condition });
    }

    execute(context)
    {
        for (let i = 0; i < this.entries.length; ++i)
        {
            // if (!this.entries[i].condition)
            {
                this.entries[i].pass.execute(context);
            }
        }
    }
}

class ParticleSystem
{
    constructor(capacity, bounds)
    {
        function particleSeedFunction(n, bounds)
        {
            const particles = new Float32Array(n * 5);

            console.log(bounds)

            for (let i = 0; i < n; ++i)
            {
                particles[i * 5 + 0] = (Math.random() * 2 - 1) * bounds[0];
                particles[i * 5 + 1] = (Math.random() * 2 - 1) * bounds[1];

                // const theta = 2 * Math.PI * Math.random();
                // const radius = 0.5 * Math.sqrt(Math.random());

                // particles[i * 5 + 0] = Math.cos(theta) * radius;
                // particles[i * 5 + 1] = Math.sin(theta) * radius;

                particles[i * 5 + 2] = 0;
                particles[i * 5 + 3] = 0;

                // particles[i * 5 + 2] = Math.random() * 2 - 1;
                // particles[i * 5 + 3] = Math.random() * 2 - 1;

                particles[i * 5 + 4] = Math.random() * 4;
            }

            return particles;
        }

        this.transformFeedbackSet = new TransformFeedbackSet(capacity, [
            { location: 0, count: 2, name: "v_Position" },
            { location: 1, count: 2, name: "v_Velocity" },
            { location: 2, count: 1, name: "v_Age" }
        ], (n) => particleSeedFunction(n, bounds));
    }

    step()
    {
        this.transformFeedbackSet.step();
    }

    draw()
    {
        this.transformFeedbackSet.draw();
    }

    dispose()
    {
        this.transformFeedbackSet.dispose();
    }
};

class FlowFieldApp
{
    constructor()
    {
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        this.updateProgram = new Program(UPDATE_VERTEX_SHADER, UPDATE_FRAGMENT_SHADER, ["v_Position", "v_Velocity", "v_Age"]);
        this.fadeProgram = new Program(FULLSCREEN_VERTEX_SHADER, FADE_FRAGMENT_SHADER);
        this.renderProgram = new Program(RENDER_VERTEX_SHADER, RENDER_FRAGMENT_SHADER);
        this.compositeProgram = new Program(FULLSCREEN_VERTEX_SHADER, COPY_FRAGMENT_SHADER);

        this.renderer = new Renderer();
        this.renderer.addPass(new SimulationPass(this.updateProgram));
        this.renderer.addPass(new TrailPass(this.fadeProgram, this.renderProgram));
        this.renderer.addPass(new CompositePass(this.compositeProgram));

        this.particleSystem = null;

        this.pingPongTarget = new PingPongTarget(canvas.width, canvas.height);

        this.state = {
            pattern: 1,
            maxAge: 4,
            maxSpeed: 0.8,
            fieldScale: 0.5,
            smoothing: 0.97,

            decay: 8,

            pointSize: 2,
            baseColor: [0.78, 0.66, 0.38],
            alpha: 0.04,
        };

        this.context = {
            time: 0,
            dt: 0,

            bounds: [0, 0],
            dpr: 0,

            state: this.state,

            particleSystem: this.particleSystem,
            pingPongTarget: this.pingPongTarget,
        };

        this.fpsBuffer = new RingBuffer(60);
        this.previousTime = 0;

        this.resize();

        window.addEventListener("resize", () => { this.resize(); });

        this.frameLoop = this.frame.bind(this);

        requestAnimationFrame(this.frameLoop);
    }

    resize()
    {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

        if ((canvas.width !== width) || (canvas.height !== height))
        {
            canvas.width = width;
            canvas.height = height;
        }

        this.pingPongTarget.resize(width, height);
        gl.viewport(0, 0, width, height);

        const aspectRatio = width / height;

        this.context.bounds = aspectRatio >= 1 ? [aspectRatio, 1] : [1, 1 / aspectRatio];
        this.context.dpr = dpr;

        if (this.particleSystem === null)
        {
            this.particleSystem = new ParticleSystem(500_000, this.context.bounds);
            this.context.particleSystem = this.particleSystem;
        }

        console.log(`RESIZE: ${width}:${height}`);
    }

    frame(currentTime)
    {
        this.context.dt = Math.min(0.05, 0.001 * (currentTime - this.previousTime));
        this.previousTime = currentTime;
        this.context.time += this.context.dt;

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        this.renderer.execute(this.context);

        this.fpsBuffer.push(this.context.dt > 0 ? 1 / this.context.dt : 0);
        // this.uiController.updateStats(this.fpsBuffer.average());

        requestAnimationFrame(this.frameLoop);
    }

    setParticleCount(count)
    {
        this.particleSystem.dispose();

        this.particleSystem = new ParticleSystem(count, this.context.bounds);
        this.context.particleSystem = this.particleSystem;
    }
}

const flowFieldApp = new FlowFieldApp();
