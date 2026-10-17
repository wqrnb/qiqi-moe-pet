(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.QiqiTrail = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function drawHeart(ctx, size) {
    const s = size / 16;
    ctx.beginPath();
    ctx.moveTo(0, s * 4);
    ctx.bezierCurveTo(-s * 10, -s * 6, -s * 4, -s * 12, 0, -s * 4);
    ctx.bezierCurveTo(s * 4, -s * 12, s * 10, -s * 6, 0, s * 4);
    ctx.fill();
  }

  function drawSakura(ctx, size) {
    ctx.fillStyle = "rgba(247, 197, 212, 0.95)";
    for (let petal = 0; petal < 5; petal += 1) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(size * 0.42, 0, size * 0.34, size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 236, 176, 0.95)";
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLaser(ctx, laser) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255, 214, 228, 0.45)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(laser.x1, laser.y1);
    ctx.lineTo(laser.x2, laser.y2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(226, 84, 122, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(laser.x1, laser.y1);
    ctx.lineTo(laser.x2, laser.y2);
    ctx.stroke();
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath();
    ctx.arc(laser.x2, laser.y2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(laser.x2 - 1.5, laser.y2 - 1.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function createLayer() {
    const particles = [];
    let laser = null;
    const pinks = ["#f4b4c8", "#e56b93", "#ffd6e4", "#d46f91"];

    return {
      setLaser: function (value) { laser = value; },
      push: function (x, y) {
        particles.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 8,
          kind: Math.random() < 0.58 ? "heart" : "sakura",
          life: 1,
          decay: 0.7 + Math.random() * 0.55,
          size: 8 + Math.random() * 9,
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 2.4,
          vx: (Math.random() - 0.5) * 22,
          vy: -12 - Math.random() * 26,
          color: pinks[Math.floor(Math.random() * pinks.length)],
        });
        if (particles.length > 96) particles.splice(0, particles.length - 96);
      },
      draw: function (ctx, width, height, dt) {
        ctx.clearRect(0, 0, width, height);
        const step = Math.min(Math.max(dt, 0) / 1000, 0.05);
        for (let index = particles.length - 1; index >= 0; index -= 1) {
          const particle = particles[index];
          particle.life -= particle.decay * step;
          particle.x += particle.vx * step;
          particle.y += particle.vy * step;
          particle.rot += particle.spin * step;
          if (particle.life <= 0) {
            particles.splice(index, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = Math.max(0, particle.life);
          ctx.translate(particle.x, particle.y);
          ctx.rotate(particle.rot);
          if (particle.kind === "heart") {
            ctx.fillStyle = particle.color;
            drawHeart(ctx, particle.size);
          } else {
            drawSakura(ctx, particle.size);
          }
          ctx.restore();
        }
        if (laser && Number.isFinite(laser.x1) && Number.isFinite(laser.x2)) drawLaser(ctx, laser);
      },
    };
  }

  return { createLayer: createLayer };
});
