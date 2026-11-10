export function box(s, cx, cz, w, d, y0, y1, yaw) {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const P = (u, v)=>[
            cx + u * c + v * sn,
            cz - u * sn + v * c
        ];
    const corners = [
        P(-w / 2, -d / 2),
        P(w / 2, -d / 2),
        P(w / 2, d / 2),
        P(-w / 2, d / 2)
    ];
    for(let i = 0; i < 4; i++){
        const a = corners[i], b = corners[(i + 1) % 4];
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
        const n = [
            dz / L,
            0,
            -dx / L
        ];
        const v0 = s.vert(a[0], y0, a[1], n), v1 = s.vert(b[0], y0, b[1], n), v2 = s.vert(b[0], y1, b[1], n), v3 = s.vert(a[0], y1, a[1], n);
        s.quad(v0, v3, v2, v1);
    }
    const t = corners.map((p)=>s.vert(p[0], y1, p[1], [
            0,
            1,
            0
        ]));
    s.quad(t[0], t[1], t[2], t[3]);
}
