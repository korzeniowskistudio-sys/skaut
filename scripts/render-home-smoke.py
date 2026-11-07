#!/usr/bin/env python3
"""Render the SKAUT smoke plate. Requires NumPy and Pillow with WebP support."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


DEPTH, HEIGHT, WIDTH = 44, 93, 156
FPS, SECONDS, OVERLAP = 15, 20, 4
PLAYBACK_RATE = 1.25
DT = np.float32(1 / FPS)
Z, Y, X = (axis.astype(np.float32) for axis in np.ogrid[:DEPTH, :HEIGHT, :WIDTH])
SHAPE = DEPTH, HEIGHT, WIDTH
ASSETS = Path(__file__).resolve().parents[1] / 'public' / 'assets'


def noise(seed, scale):
    """A smooth 3D noise field with a chosen correlation length in voxels."""
    rng = np.random.default_rng(seed)
    spectrum = np.fft.rfftn(rng.standard_normal(SHAPE, dtype=np.float32))
    frequencies = [
        np.fft.fftfreq(DEPTH)[:, None, None],
        np.fft.fftfreq(HEIGHT)[None, :, None],
        np.fft.rfftfreq(WIDTH)[None, None, :],
    ]
    lowpass = np.exp(-2 * (np.pi * scale) ** 2 * sum(f * f for f in frequencies))
    field = np.fft.irfftn(spectrum * lowpass, s=SHAPE, axes=(0, 1, 2)).astype(np.float32)
    return field / field.std()


def curl(seed, scale):
    """Curl of a vector potential. The small eddies stir without expanding the air."""
    a, b, c = (noise(seed + index, scale) for index in range(3))
    az, ay, ax = np.gradient(a)
    bz, by, bx = np.gradient(b)
    cz, cy, cx = np.gradient(c)
    return cy - bz, az - cx, bx - ay


def trilinear(volume, x, y, z, *, bounds=False):
    """Trace into the previous density volume with clear air outside the box."""
    inside = (x >= 0) & (x < WIDTH - 1) & (y >= 0) & (y < HEIGHT - 1) & (z >= 0) & (z < DEPTH - 1)
    x = np.clip(x, 0, WIDTH - 1.001)
    y = np.clip(y, 0, HEIGHT - 1.001)
    z = np.clip(z, 0, DEPTH - 1.001)
    ix, iy, iz = (coord.astype(np.int32) for coord in (x, y, z))
    fx, fy, fz = (coord - base.astype(np.float32) for coord, base in ((x, ix), (y, iy), (z, iz)))
    stride = HEIGHT * WIDTH
    index = iz * stride + iy * WIDTH + ix
    data = volume.reshape(-1)

    def xy(offset):
        origin = index + offset
        a, b, c, d = (data[origin + n] for n in (0, 1, WIDTH, WIDTH + 1))
        value = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
        if not bounds:
            return value
        return value, np.minimum(np.minimum(a, b), np.minimum(c, d)), np.maximum(np.maximum(a, b), np.maximum(c, d))

    if not bounds:
        return inside * (xy(0) * (1 - fz) + xy(stride) * fz)
    front, front_min, front_max = xy(0)
    back, back_min, back_max = xy(stride)
    return (inside * (front * (1 - fz) + back * fz),
            inside * np.minimum(front_min, back_min), inside * np.maximum(front_max, back_max))


# Vary the sources in all three axes so individual plumes can occlude one another.
SOURCES = (
    (15, 8, 12, 17, 6, 6, .48, .00),
    (47, 4, 24, 11, 6, 7, .93, 1.64),
    (66, 13, 32, 10, 6, 5, .46, 2.86),
    (87, 9, 15, 19, 7, 8, .49, 3.91),
    (114, 4, 27, 12, 5, 7, .91, .42),
    (146, 13, 23, 14, 9, 8, .79, 2.45),
)
# Each moving vortex rotates around a different axis.
VORTICES = (
    (27, 30, 17, 25, .31, .33, .55, .0),
    (62, 34, 25, 21, .35, -.36, -.22, 1.6),
    (103, 30, 16, 28, -.27, .12, .43, 2.4),
    (134, 43, 27, 25, .26, -.26, -.38, 4.2),
)


class SmokeVolume:
    def __init__(self):
        self.density = np.zeros(SHAPE, dtype=np.float32)
        broad = curl(21, 5.2)
        detail = curl(37, 1.9)
        self.wind = tuple(coarse * 7 + fine * 1.65 for coarse, fine in zip(broad, detail))
        self.gust = curl(52, 3.7)
        self.source_grain = np.clip(1 + .34 * noise(68, 2.3) + .18 * noise(97, .9), .16, 2.0)
        self.filaments = np.clip(1 + .14 * noise(103, 1.15) + .08 * noise(109, .6), .55, 1.45)
        self.boundary = np.minimum(Z, DEPTH - 1 - Z) / 5
        self.boundary = np.minimum(self.boundary, 1).astype(np.float32)

    def step(self, time):
        gust = 3.2 * np.sin(time * .29)
        vx = self.wind[0] + gust * self.gust[0] + (4.3 + .9 * np.sin(time * .25)) + .021 * Y
        vy = self.wind[1] + gust * self.gust[1] + 2.0 + 1.9 * self.density / (self.density + .18)
        vz = self.wind[2] + gust * self.gust[2]
        for x, y, z, radius, spin_x, spin_y, spin_z, phase in VORTICES:
            dx = X - (x + 8 * np.sin(time * .18 + phase))
            dy = Y - (y + 6 * np.cos(time * .24 + phase))
            dz = Z - (z + 5 * np.sin(time * .17 + phase))
            swirl = np.exp(-(dx * dx + dy * dy + dz * dz) / (radius * radius))
            vx += swirl * (spin_y * dz - spin_z * dy)
            vy += swirl * (spin_z * dx - spin_x * dz)
            vz += swirl * (spin_x * dy - spin_y * dx)
        dx, dy, dz = DT * vx, DT * vy, DT * vz
        smoke, lowest, highest = trilinear(self.density, X - dx, Y - dy, Z - dz, bounds=True)
        restored = trilinear(smoke, X + dx, Y + dy, Z + dz)
        # Correct some of the interpolation blur while keeping density within
        # the original sample range. This preserves thin, curling tendrils.
        smoke = np.clip(smoke + .41 * (self.density - restored), lowest, highest)
        smoke *= .991 * (.96 + .04 * self.boundary)
        for x, y, z, sx, sy, sz, power, phase in SOURCES:
            dx = (X - x - 10 * np.sin(time * .36 + phase)) / sx
            dy = (Y - y - 3 * np.cos(time * .29 + phase)) / sy
            dz = (Z - z - 4 * np.sin(time * .25 + phase)) / sz
            puff = (.37 + .34 * np.sin(time * .67 + phase) + .25 * np.sin(time * 1.13 + phase * 2)) ** 2
            smoke += DT * power * (.10 + puff) * self.source_grain * np.exp(-(dx * dx + dy * dy + dz * dz))
        self.density = smoke

    def plate(self):
        optical = self.density * self.filaments
        # Light travels down through the cloud. Deeper voxels receive less direct light.
        from_top = np.cumsum(optical[:, ::-1], axis=1)[:, ::-1] - optical
        above_left = np.roll(from_top, 4, axis=2)
        above_left[:, :, :4] = from_top[:, :, :4]
        light = .19 + .66 * np.exp(-.35 * from_top) + .15 * np.exp(-.17 * above_left)
        thickness = .34 * optical[::-1]
        camera_depth = np.cumsum(thickness, axis=0) - thickness
        scatter = np.sum(np.exp(-camera_depth) * (-np.expm1(-thickness)) * light[::-1], axis=0)
        # The camera crops through the open volume, away from the solver's borders.
        frame = scatter[6:85, 7:147][::-1]
        luma = 245 * np.clip(frame, 0, 1) ** .88
        return np.rint(luma).astype(np.uint8)


def frames():
    smoke = SmokeVolume()
    warmup = 16 * FPS
    for index in range(warmup + (SECONDS + OVERLAP) * FPS):
        smoke.step(index / FPS)
        if index >= warmup:
            yield smoke.plate()


def write_loop(loop):
    length, overlap = SECONDS * FPS, OVERLAP * FPS
    for index in range(overlap):
        blend = (1 - np.cos(np.pi * index / overlap)) * .5
        loop[index] = np.rint((1 - blend) * loop[length + index] + blend * loop[index]).astype(np.uint8)
    edge_detail = ImageFilter.UnsharpMask(radius=1.8, percent=72, threshold=2)
    images = [Image.fromarray(frame).resize((480, 270), Image.Resampling.BICUBIC)
              .filter(edge_detail).convert('RGB') for frame in loop[:length]]
    frame_time = 1000 / (FPS * PLAYBACK_RATE)
    durations = [round((i + 1) * frame_time) - round(i * frame_time) for i in range(length)]
    images[0].save(ASSETS / 'home-smoke-still.webp', quality=84)
    # Complete frames avoid artifacts from lossy partial-frame updates.
    images[0].save(ASSETS / 'home-smoke-loop.webp', save_all=True, append_images=images[1:],
                   loop=0, duration=durations, quality=82, method=4, kmax=1)


if __name__ == '__main__':
    write_loop(list(frames()))
