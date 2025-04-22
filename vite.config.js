import path from 'path';

export default {
  build: {
    outDir: 'dist', // Output directory
    rollupOptions: {
      input: path.resolve(__dirname, 'content.js'), // Entry point
      output: {
        dir: path.resolve(__dirname, 'dist'), // Output directory
        entryFileNames: 'main.js', // Output file name
        format: 'esm', // Ensure it's using ES Modules format
      },
    },
  },
};
