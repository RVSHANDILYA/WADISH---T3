import animate from "tailwindcss-animate";
import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}"],
  theme: {
  	extend: {
  		colors: {
  			canvas: '#F8FAFC',
  			surface: '#F9FAFB',
  			navy: '#073b4c',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			tremor: {
  				brand: {
  					faint: colors.teal[50],
  					muted: colors.teal[200],
  					subtle: colors.teal[400],
  					DEFAULT: '#0f766e',
  					emphasis: colors.teal[800],
  					inverted: '#fff'
  				},
  				background: {
  					muted: '#F9FAFB',
  					subtle: '#F8FAFC',
  					DEFAULT: '#fff',
  					emphasis: '#073b4c'
  				},
  				border: {
  					DEFAULT: colors.slate[100]
  				},
  				ring: {
  					DEFAULT: colors.slate[200]
  				},
  				content: {
  					subtle: colors.slate[500],
  					DEFAULT: colors.slate[600],
  					emphasis: '#073b4c',
  					strong: colors.slate[900],
  					inverted: '#fff'
  				}
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: 'hsl(var(--destructive))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'Segoe UI',
  				'system-ui',
  				'sans-serif'
  			]
  		},
  		fontSize: {
  			'tremor-label': [
  				'1rem',
  				{
  					lineHeight: '1.5rem'
  				}
  			],
  			'tremor-default': [
  				'1rem',
  				{
  					lineHeight: '1.6rem'
  				}
  			],
  			'tremor-title': [
  				'1.25rem',
  				{
  					lineHeight: '1.75rem'
  				}
  			],
  			'tremor-metric': [
  				'2rem',
  				{
  					lineHeight: '2.5rem'
  				}
  			]
  		},
  		borderRadius: {
  			'tremor-small': '.5rem',
  			'tremor-default': '.75rem',
  			'tremor-full': '9999px',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			'tremor-card': '0 1px 2px 0 rgb(15 23 42 / .04)',
  			'tremor-input': '0 1px 2px 0 rgb(15 23 42 / .04)',
  			'tremor-dropdown': '0 4px 12px rgb(15 23 42 / .08)'
  		}
  	}
  },
  safelist: [{ pattern: /^(bg|text|border|ring|stroke|fill)-(teal|slate|cyan|amber|blue)-(50|100|200|300|400|500|600|700|800|900|950)$/, variants: ["hover", "ui-selected"] }],
  plugins: [animate],
};

