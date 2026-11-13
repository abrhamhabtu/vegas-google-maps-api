// Metres, with the driving origin on the rear axle. Zoox's envelope comes from
// its vehicle guides. Ojai proportions and Cybercab's length and axle positions
// are scaled from manufacturer imagery. Tesla publishes Cybercab's width/height.
export const ROBOTAXI_DIMENSIONS = {
  zoox: { length: 3.63, width: 1.774, height: 1.949, wheelbase: 2.72, nose: 3.175 },
  waymo: { length: 4.85, width: 1.99, height: 2.02, wheelbase: 3.22, nose: 3.98 },
  tesla: { length: 4.25, width: 1.754, height: 1.408, wheelbase: 2.72, nose: 3.40 },
};
