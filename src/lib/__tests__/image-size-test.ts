import { shrinkToFit } from '../image-size';

describe('shrinkToFit', () => {
  test('leaves images that fit alone', () => {
    expect(shrinkToFit(1080, 2400, 2400)).toBeNull();
    expect(shrinkToFit(720, 960, 2400)).toBeNull();
  });

  test('limits the longest side of photos in either orientation', () => {
    expect(shrinkToFit(4000, 3000, 2400)).toEqual({ width: 2400 });
    expect(shrinkToFit(3000, 4000, 2400)).toEqual({ height: 2400 });
  });
});
