import { test, useSpectron } from '../../helpers/spectron';
import { showSettingsWindow } from '../../helpers/modules/settings/settings';
import { clickButton, clickTab } from '../../helpers/modules/core';
import { useForm } from '../../helpers/modules/forms';
useSpectron();

test('Shared components ', async t => {
  const { readForm, fillForm, assertFormContains } = useForm('demo-form');

  // open demo-form
  await showSettingsWindow('Experimental');
  await clickButton('Show Shared Components Library');
  await clickTab('Demo Form');

  const initialFormData = await readForm();

  t.deepEqual(initialFormData, [
    { name: 'name', value: '', displayValue: '' },
    { name: 'gender', value: '', displayValue: null },
    { name: 'age', value: '0', displayValue: '0' },
    { name: 'city', value: '', displayValue: null },
    { name: 'colors', value: [], displayValue: [] },
    { name: 'addIntroduction', value: false, displayValue: false },
    { name: 'confirm1', value: false, displayValue: false },
    { name: 'confirm2', value: false, displayValue: false },
  ]);

  await fillForm({
    name: 'John Doe',
    gender: 'Male',
    colors: ['Red', 'Orange'],
    age: 20,
    city: 'Cairo',
    addIntroduction: true,
    introduction: 'Hello World!',
    confirm1: true,
    confirm2: true,
  });

  const filledFormData = await readForm();

  t.deepEqual(filledFormData, [
    { name: 'name', value: 'John Doe', displayValue: 'John Doe' },
    { name: 'gender', value: 'male', displayValue: 'Male' },
    { name: 'age', value: '20', displayValue: '20' },
    { name: 'city', value: 'C', displayValue: 'Cairo' },
    {
      name: 'colors',
      value: [1, 4],
      displayValue: ['Red', 'Orange'],
    },
    { name: 'addIntroduction', value: true, displayValue: true },
    {
      name: 'introduction',
      value: 'Hello World!',
      displayValue: 'Hello World!',
    },
    { name: 'confirm1', value: true, displayValue: true },
    { name: 'confirm2', value: true, displayValue: true },
  ]);

  assertFormContains({
    name: 'John Doe',
    gender: 'Male',
    colors: ['Red', 'Orange'],
    age: 20,
    city: 'Cairo',
    addIntroduction: true,
    introduction: 'Hello World!',
    confirm1: true,
    confirm2: true,
  });
});
