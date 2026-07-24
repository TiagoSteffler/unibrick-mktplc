import pluginVue from 'eslint-plugin-vue'

export default [
  ...pluginVue.configs['flat/essential'],
  {
    files: ['src/**/*.{js,vue}'],
    rules: {
      'no-unused-vars': 'warn',
      'vue/no-unused-components': 'warn'
    }
  }
]
