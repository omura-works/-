// 02 反応拡散 (Gray-Scott): 2 種の化学物質の式だけで模様が育つ
SCENES.push((() => {
  const DUR = 9.6, SW = 800, SH = 450, STEPS = CFG.rdSteps || 34; let G, gl, step, show, tex, fbo, cur = 0;
  const STEP = `
uniform sampler2D S; uniform vec2 px; in vec2 uv; out vec4 o;
void main(){
  vec2 c=texture(S,uv).xy;
  vec2 l=(texture(S,uv+vec2(px.x,0)).xy+texture(S,uv-vec2(px.x,0)).xy+texture(S,uv+vec2(0,px.y)).xy+texture(S,uv-vec2(0,px.y)).xy)*.2
        +(texture(S,uv+px).xy+texture(S,uv-px).xy+texture(S,uv+vec2(px.x,-px.y)).xy+texture(S,uv+vec2(-px.x,px.y)).xy)*.05-c;
  // 場所によって係数を少し変え、斑点〜迷路状まで複数の相を同居させる
  float f=.050+.010*sin(uv.x*5.+1.)*cos(uv.y*3.5), k=.0620+.0016*cos(uv.x*3.-uv.y*4.);
  float r=c.x*c.y*c.y;
  o=vec4(clamp(c+vec2(l.x-r+f*(1.-c.x), .5*l.y+r-(f+k)*c.y),0.,1.),0,1);
}`;
  const SHOW = `
uniform sampler2D S; uniform vec2 sz; in vec2 uv; out vec4 o;
float V(vec2 p){ // 手動バイリニア (float テクスチャは線形補間に頼らない)
  p=p*sz-.5; vec2 i=floor(p), f=p-i; f=f*f*(3.-2.*f); ivec2 a=ivec2(i), m=ivec2(sz)-1;
  #define F(dx,dy) texelFetch(S,clamp(a+ivec2(dx,dy),ivec2(0),m),0).g
  return mix(mix(F(0,0),F(1,0),f.x),mix(F(0,1),F(1,1),f.x),f.y);
}
void main(){
  vec2 e=1.2/sz; float v=V(uv);
  vec3 n=normalize(vec3((V(uv-vec2(e.x,0))-V(uv+vec2(e.x,0)))*7.,(V(uv-vec2(0,e.y))-V(uv+vec2(0,e.y)))*7.,1.));
  vec3 l=normalize(vec3(-.5,.6,.65));
  vec3 col=mix(vec3(.015,.02,.045),vec3(.03,.22,.36),smoothstep(.02,.16,v));
  col=mix(col,vec3(.98,.50,.24),smoothstep(.15,.30,v));
  col=mix(col,vec3(1.,.90,.74),smoothstep(.30,.42,v));
  col*=.35+.85*max(dot(n,l),0.);
  col+=pow(max(dot(reflect(-l,n),vec3(0,0,1)),0.),28.)*smoothstep(.1,.3,v)*.55;
  vec2 q=uv-.5; col*=1.-dot(q,q)*.9;
  o=vec4(pow(col,vec3(.4545)),1);
}`;
  return {
    name: 'rd', frames: 288,
    init(ctx) {
      G = makeGL(W, H); gl = G.gl;
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('float FBO 非対応');
      step = G.program(STEP); show = G.program(SHOW);
      // 種: タイトル文字 + ランダムな点
      const c = document.createElement('canvas'); c.width = SW; c.height = SH; const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `900 100px ${EN}`;
      const fs = Math.min(190, 100 * SW * 0.8 / x.measureText(CFG.title).width); x.font = `900 ${fs}px ${EN}`;
      x.fillText(CFG.title, SW / 2, SH / 2 + fs * 0.2);
      const r = rng(5); for (let i = 0; i < 46; i++) { x.beginPath(); x.arc(r() * SW, r() * SH, 3 + r() * 5, 0, 7); x.fill(); }
      const d = x.getImageData(0, 0, SW, SH).data, a = new Float32Array(SW * SH * 4);
      for (let yy = 0; yy < SH; yy++) for (let xx = 0; xx < SW; xx++) {
        const on = d[((SH - 1 - yy) * SW + xx) * 4 + 3] > 128, o = (yy * SW + xx) * 4;
        a[o] = on ? 0.5 : 1; a[o + 1] = on ? 0.25 + r() * 0.1 : 0;
      }
      tex = [0, 1].map(k => {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, SW, SH, 0, gl.RGBA, gl.FLOAT, k ? null : a);
        for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
        return t;
      });
      fbo = tex.map(t => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; });
    },
    frame(ctx, i, t) {
      gl.activeTexture(gl.TEXTURE0); gl.viewport(0, 0, SW, SH);
      const n = i === 0 ? 0 : STEPS;
      for (let s = 0; s < n; s++) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]); gl.bindTexture(gl.TEXTURE_2D, tex[cur]); step.use({ S: { tex: 0 }, px: [1 / SW, 1 / SH] }); cur = 1 - cur; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
      show.use({ S: { tex: 0 }, sz: [SW, SH] });
      ctx.drawImage(G.cv, 0, 0);
      chapter(ctx, t, DUR, '02', 'REACTION–DIFFUSION', '模様が自分で育つ', `Gray-Scott モデルを GPU で ${(i * STEPS).toLocaleString()} ステップ時間発展`);
      edgeFade(ctx, t, DUR);
    }
  };
})());
