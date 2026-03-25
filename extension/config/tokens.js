// PixelPin Token System — CSS-to-Tailwind mappings (extensible by teams)

const PIXELPIN_TOKENS = {
  // Spacing: px value → Tailwind class suffix
  spacing: {
    '0px': '0', '1px': 'px', '2px': '0.5', '4px': '1', '6px': '1.5',
    '8px': '2', '10px': '2.5', '12px': '3', '14px': '3.5', '16px': '4',
    '20px': '5', '24px': '6', '28px': '7', '32px': '8', '36px': '9',
    '40px': '10', '44px': '11', '48px': '12', '56px': '14', '64px': '16',
    '80px': '20', '96px': '24',
  },

  fontSize: {
    '12px': 'xs', '14px': 'sm', '16px': 'base', '18px': 'lg',
    '20px': 'xl', '24px': '2xl', '30px': '3xl', '36px': '4xl', '48px': '5xl',
  },

  fontWeight: {
    '100': 'thin', '200': 'extralight', '300': 'light', '400': 'normal',
    '500': 'medium', '600': 'semibold', '700': 'bold', '800': 'extrabold', '900': 'black',
  },

  borderRadius: {
    '0px': 'rounded-none', '2px': 'rounded-sm', '4px': 'rounded',
    '6px': 'rounded-md', '8px': 'rounded-lg', '12px': 'rounded-xl',
    '16px': 'rounded-2xl', '24px': 'rounded-3xl', '9999px': 'rounded-full',
  },

  // CSS property → Tailwind prefix mapping
  propertyPrefix: {
    'padding': 'p', 'padding-top': 'pt', 'padding-right': 'pr',
    'padding-bottom': 'pb', 'padding-left': 'pl',
    'margin': 'm', 'margin-top': 'mt', 'margin-right': 'mr',
    'margin-bottom': 'mb', 'margin-left': 'ml',
    'width': 'w', 'height': 'h',
    'gap': 'gap',
    'font-size': 'text', 'font-weight': 'font',
    'border-radius': 'rounded',
    'line-height': 'leading',
  },
};

// Expose globally for content script
window.__pixelPinTokens = PIXELPIN_TOKENS;
