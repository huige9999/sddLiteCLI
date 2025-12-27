export default {
  id: 'hello',
  title: 'Hello',
  setup({ runtime }) {
    console.log('hello');
    runtime.onReset(() => {});
  },
};
