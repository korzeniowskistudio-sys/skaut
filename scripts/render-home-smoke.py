#!/usr/bin/env python3
"""Render the original SKAUT smoke loop. Requires NumPy and Pillow with WebP support."""
from pathlib import Path

import numpy as np
from PIL import Image


WIDTH, HEIGHT = 576, 324
FPS, SECONDS, OVERLAP = 15, 20, 4
DT = 1 / FPS
Y, X = np.mgrid[:HEIGHT, :WIDTH].astype(np.float32)
ASSETS = Path(__file__).resolve().parents[1] / 'public' / 'assets'


def turbulence(seed):
    rng = np.random.default_rng(seed)
    field = np.zeros_like(X)
    for scale, strength in [(1, .46), (2, .27), (4, .15), (8, .08), (16, .04)]:
        grid = rng.random((5 * scale, 9 * scale), dtype=np.float32)
        detail = Image.fromarray(grid).resize((WIDTH, HEIGHT), Image.Resampling.BICUBIC)
        field += strength * np.asarray(detail)
    return field


def sample(field, x, y):
    """Bilinear backtrace. Air at the top is clear; smoke can enter along the sides."""
    inside = y >= 0
    x = np.clip(x, 0, WIDTH - 1.001)
    y = np.clip(y, 0, HEIGHT - 1.001)
    ix, iy = x.astype(np.int32), y.astype(np.int32)
    fx, fy = x - ix, y - iy
    top = (1 - fx) * field[iy, ix] + fx * field[iy, ix + 1]
    bottom = (1 - fx) * field[iy + 1, ix] + fx * field[iy + 1, ix + 1]
    return (inside * ((1 - fy) * top + fy * bottom)).astype(np.float32)


class SmokePlane:
    def __init__(self, seed, emitters, vortices, rise, decay):
        self.density = np.zeros_like(X)
        self.emitters = emitters
        self.vortices = vortices
        self.rise = rise
        self.decay = decay
        self.texture = turbulence(seed)
        self.secondary_texture = turbulence(seed + 37) - .5
        # The perpendicular gradient adds small eddies to the broad rolling flow.
        gy, gx = np.gradient(self.texture)
        self.eddy_x, self.eddy_y = gy * 825, -gx * 825

    def step(self, time):
        wind_x = 8.0 + 9.5 * (0.6 - Y / HEIGHT) + self.eddy_x * np.cos(.21 * time)
        wind_y = -self.rise + self.eddy_y * np.cos(.21 * time)
        for cx, cy, radius, turn, phase in self.vortices:
            dx = X - cx - 26 * np.sin(time * .15 + phase)
            dy = Y - cy - 19 * np.cos(time * .17 + phase)
            spin = turn * np.exp(-(dx * dx + dy * dy) / (radius * radius))
            wind_x -= dy * spin
            wind_y += dx * spin

        smoke = sample(self.density, X - DT * wind_x, Y - DT * wind_y)
        smoke *= self.decay
        # Each source releases uneven puffs rather than a steady stripe.
        grain = self.texture + .56 * np.sin(.24 * time) * self.secondary_texture
        for cx, cy, width, height, strength, phase in self.emitters:
            dx = (X - cx - 28 * np.sin(time * .29 + phase)) / width
            dy = (Y - cy - 12 * np.sin(time * .37 + phase)) / height
            puff = .17 + .83 * (.52 + .48 * np.sin(time * .53 + phase)) ** 2
            smoke += DT * strength * puff * np.exp(-(dx * dx + dy * dy)) * (.05 + 2.0 * grain)
        self.density = smoke

    def lighting(self, strength):
        cloud = 1 - np.exp(-self.density * strength)
        # A small offset towards the light gives the rolled edges depth.
        shadow = np.roll(cloud, (5, 8), axis=(0, 1))
        shadow[:5, :] = cloud[:5, :]
        shadow[:, :8] = cloud[:, :8]
        lighting = np.clip(.63 + 1.0 * (cloud - shadow), .36, .96)
        variation = .79 + .38 * self.texture + .42 * self.secondary_texture
        return cloud, cloud * lighting * variation


def frames():
    rear = SmokePlane(17,
        [(25, 304, 72, 47, .65, 1.0), (210, 295, 85, 39, .49, 3.2),
         (377, 315, 105, 49, .55, 4.4), (559, 272, 70, 48, .61, .2)],
        [(75, 227, 91, .30, 1.3), (208, 248, 68, -.33, 2.1),
         (343, 236, 87, .32, 3.0), (496, 222, 101, -.34, .4)],
        rise=11, decay=.990)
    front = SmokePlane(39,
        [(70, 315, 70, 35, .64, 2.3), (264, 303, 62, 39, .9, .7),
         (454, 320, 76, 40, .76, 3.5), (569, 265, 63, 45, .68, 2.9)],
        [(72, 262, 73, -.38, 2.1), (230, 253, 76, .42, 1.0),
         (390, 263, 86, -.35, 4.1), (517, 207, 74, .42, 3.3)],
        rise=13, decay=.986)

    # A softly lit bank behind the moving plumes carries depth into the shadows.
    veil_height = (Y - HEIGHT * .66 + 77 * (rear.texture - .5)) / 38
    veil = (.18 + .44 * rear.texture) / (1 + np.exp(-veil_height))
    warmup = 22 * FPS
    for index in range(warmup + (SECONDS + OVERLAP) * FPS):
        time = index / FPS
        rear.step(time)
        front.step(time)
        if index >= warmup:
            _, distant = rear.lighting(1.22)
            near_alpha, near = front.lighting(1.44)
            shade = 2 + 250 * (.36 * veil + .73 * distant * (1 - .65 * near_alpha) + .93 * near)
            yield np.clip(shade, 0, 255).astype(np.uint8)


def main():
    loop = list(frames())
    length, overlap = SECONDS * FPS, OVERLAP * FPS
    for index in range(overlap):
        blend = (1 - np.cos(np.pi * index / overlap)) * .5
        loop[index] = np.rint((1 - blend) * loop[length + index] + blend * loop[index]).astype(np.uint8)
    images = [Image.fromarray(frame).resize((480, 270), Image.Resampling.LANCZOS).convert('RGB')
              for frame in loop[:length]]
    durations = [round((i + 1) * 1000 / FPS) - round(i * 1000 / FPS) for i in range(length)]
    images[0].save(ASSETS / 'home-smoke-still.webp', quality=84)
    # Full frames prevent visible seams from lossy partial-frame updates.
    images[0].save(ASSETS / 'home-smoke-loop.webp', save_all=True, append_images=images[1:],
                   loop=0, duration=durations, quality=83, method=4, kmax=1)


if __name__ == '__main__':
    main()
