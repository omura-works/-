// 01 マンデルバルブ: 距離関数だけで描く 3D フラクタル (レイマーチング)
SCENES.push((() => {
  const DUR = 9.6; let G, prog;
  const FS = `
uniform vec2 R; uniform float T; uniform float PW;
in vec2 uv; out vec4 o;
vec4 trap;
float de(vec3 p){
  vec3 z=p; float dr=1., r=0.; trap=vec4(1e9);
  for(int i=0;i<8;i++){
    r=length(z); if(r>2.2) break;
    float th=acos(z.z/max(r,1e-6))*PW, ph=atan(z.y,z.x)*PW, rp=pow(r,PW-1.);
    dr=rp*PW*dr+1.;
    z=rp*r*vec3(sin(th)*cos(ph),sin(th)*sin(ph),cos(th))+p;
    trap=min(trap,vec4(abs(z),dot(z,z)));
  }
  return .5*log(max(r,1e-6))*r/dr;
}
vec3 nrm(vec3 p,float e){
  vec2 k=vec2(1,-1);
  return normalize(k.xyy*de(p+k.xyy*e)+k.yyx*de(p+k.yyx*e)+k.yxy*de(p+k.yxy*e)+k.xxx*de(p+k.xxx*e));
}
float shadow(vec3 p,vec3 l){
  float s=1., t=.01;
  for(int i=0;i<28;i++){ float d=de(p+l*t); s=min(s,10.*d/t); t+=clamp(d,.006,.12); if(s<.01||t>2.) break; }
  return clamp(s,0.,1.);
}
vec3 bg(vec3 rd){
  float g=pow(max(0.,1.-length(rd.xy*vec2(.8,1.))),2.);
  return vec3(.010,.013,.024)+vec3(.035,.05,.10)*g+vec3(.10,.04,.015)*pow(max(0.,rd.y*.5+.3),3.);
}
vec3 render(vec2 q){
  float an=T*.21+.6, el=.32+.22*sin(T*.31), rad=2.75-.45*smoothstep(0.,9.6,T);
  vec3 ro=rad*vec3(cos(an)*cos(el),sin(el),sin(an)*cos(el)), ww=normalize(-ro), uu=normalize(cross(ww,vec3(0,1,0))), vv=cross(uu,ww);
  vec3 rd=normalize(q.x*uu+q.y*vv+1.75*ww);
  vec3 col=bg(rd);
  float b=dot(ro,rd), c=dot(ro,ro)-1.44, h=b*b-c;
  if(h>0.){
    h=sqrt(h); float t=max(0.,-b-h), tm=-b+h, d=1.; int n=0;
    for(int i=0;i<120;i++){ d=de(ro+rd*t); if(d<.0006*t||t>tm) break; t+=d; n=i; }
    float glow=float(n)/120.;
    if(t<tm){
      vec4 tr=trap; vec3 p=ro+rd*t, nn=nrm(p,.0008*t);
      vec3 l1=normalize(vec3(.55,.75,-.35)), l2=normalize(vec3(-.7,.1,.6));
      float sh=shadow(p+nn*.003,l1), ao=pow(1.-glow,2.2)*clamp(.35+tr.w*.9,0.,1.);
      vec3 base=mix(vec3(.10,.38,.85),vec3(1.,.52,.20),smoothstep(.15,.85,tr.w*.9+tr.y*.45));
      base=mix(base,vec3(.95,.92,.85),smoothstep(.5,1.,tr.x)*.6);
      base*=.75+.25*cos(6.2831*(tr.z*1.5+vec3(0.,.1,.2)));
      float dif=max(dot(nn,l1),0.)*sh, rim=pow(1.-max(dot(nn,-rd),0.),3.);
      vec3 hv=normalize(l1-rd);
      col=base*(dif*vec3(1.25,1.1,.95)*1.5 + ao*(vec3(.10,.16,.30)*(.6+.4*nn.y)+max(dot(nn,l2),0.)*vec3(.12,.24,.42)));
      col+=pow(max(dot(nn,hv),0.),40.)*sh*vec3(1.,.9,.8)*.7 + rim*ao*vec3(.25,.45,.8)*.35;
      col=mix(col,bg(rd),smoothstep(2.6,4.2,t)*.5);
    }
    col+=vec3(1.,.45,.18)*pow(glow,2.2)*.55;
  }
  return col;
}
void main(){
  vec3 col=vec3(0);
  for(int s=0;s<AA;s++){
    vec2 of=AA>1?(vec2(float(s%2),float(s/2))-.5)*.5+vec2(.125*float(s/2),-.125*float(s%2)):vec2(0);
    col+=render((gl_FragCoord.xy+of-.5*R)/R.y*2.);
  }
  col/=float(AA);
  col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14);
  col=pow(clamp(col,0.,1.),vec3(.4545));
  vec2 v=uv-.5; col*=1.-dot(v,v)*.7;
  o=vec4(col,1);
}`;
  return {
    name: 'bulb', frames: 288, split: 6,
    init() { G = makeGL(W, H); prog = G.program('#define AA ' + (CFG.aa || 2) + '\n' + FS); },
    frame(ctx, i, t) {
      prog.use({ R: [W, H], T: t, PW: 7.2 + 1.6 * Math.sin(t * 0.42 - 0.9) });
      ctx.drawImage(G.cv, 0, 0);
      chapter(ctx, t, DUR, '01', 'RAY MARCHING', '3D フラクタル', 'ポリゴン 0 個・テクスチャ 0 枚。距離関数 1 本だけで陰影まで計算');
      edgeFade(ctx, t, DUR);
    }
  };
})());
