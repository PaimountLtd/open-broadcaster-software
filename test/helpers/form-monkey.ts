import { sleep } from './sleep';
import { cloneDeep, isMatch } from 'lodash';
import { click, TExecutionContext } from './spectron';

interface IUIInput {
  id: string;
  type: string;
  name: string;
  title: string;
  selector: string;
  loading: boolean;
}

type FNValueSetter = (form: FormMonkey, input: IUIInput) => Promise<unknown>;
type TListOption = { value: string; title: string };

export type TFormMonkeyData = Dictionary<string | boolean | FNValueSetter>;

const DEFAULT_SELECTOR = 'body';

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * helper for simulating user input into SLOBS forms
 */
export class FormMonkey {
  constructor(
    public t: TExecutionContext,
    private formSelector?: string,
    private showLogs = false,
  ) {
    if (!formSelector) this.formSelector = DEFAULT_SELECTOR;
  }

  get client() {
    return this.t.context.app.client;
  }

  async getInputs(): Promise<IUIInput[]> {
    const formSelector = this.formSelector;

    if (formSelector !== DEFAULT_SELECTOR) {
      await this.client.waitForExist(formSelector, 15000);
    }

    const result = [];
    const $inputs = await this.client.$$(`${formSelector} [data-role=input]`);
    this.log(`${$inputs.length} inputs found in ${formSelector}`);

    for (const $input of $inputs) {
      const id = ($input as any).ELEMENT;
      const name = (await this.client.elementIdAttribute(id, 'data-name')).value;
      if (!name) continue;
      result.push(await this.getInput(name));
    }
    return result;
  }

  async getInput(name: string): Promise<IUIInput> {
    const selector = `${this.formSelector} [data-name="${name}"]`;
    await this.client.waitForVisible(selector);
    const $el = await this.client.$(selector);
    const id = ($el as any).value.ELEMENT;
    const type = await this.getAttribute(selector, 'data-type');
    const title = await this.getAttribute(selector, 'data-title');
    const loadingAttr = await this.getAttribute(selector, 'data-loading');
    const loading = loadingAttr === 'true';
    return { id, name, type, selector, loading, title };
  }

  /**
   * fill the form with values
   */
  async fill(formData: Dictionary<any>, useTitleAsValue = false) {
    this.log('fill form with data', formData);
    await this.waitForLoading();

    // tslint:disable-next-line:no-parameter-reassignment TODO
    formData = cloneDeep(formData);
    const inputKeys = Object.keys(formData);

    for (const inputKey of inputKeys) {
      const inputName = useTitleAsValue ? await this.getInputNameByTitle(inputKey) : inputKey;
      const input = await this.getInput(inputName);
      if (!input.name) {
        // skip no-name fields
        continue;
      }

      const value = formData[inputKey];
      this.log(`set the value for the ${input.type} field: ${inputKey} = ${value}`);

      if (typeof value === 'function') {
        // apply custom setter
        await (value as FNValueSetter)(this, input);
      } else {
        // apply default setter
        switch (input.type) {
          case 'text':
          case 'number':
          case 'textArea':
            await this.setTextValue(input.selector, value);
            break;
          case 'bool':
            await this.setBoolValue(input.selector, value);
            break;
          case 'toggle':
            await this.setToggleValue(input.selector, value);
            break;
          case 'list':
            await this.setListValue(input.selector, value, useTitleAsValue);
            break;
          case 'fontFamily':
            await this.setListValue(`${input.selector} [data-type="list"]`, value, useTitleAsValue);
            break;
          case 'color':
            await this.setColorValue(input.selector, value);
            break;
          case 'slider':
          case 'fontSize':
          case 'fontWeight':
            await this.setSliderValue(input.selector, value);
            break;
          case 'date':
            await this.setDateValue(input.selector, value);
            break;
          case 'twitchTags':
            await this.setTwitchTagsValue(input.selector, value);
            break;
          default:
            throw new Error(`No setter found for input type = ${input.type}`);
        }
      }

      delete formData[inputKey];
    }

    const notFoundFields = Object.keys(formData);
    if (notFoundFields.length) {
      throw new Error(`Fields not found: ${JSON.stringify(notFoundFields)}`);
    }
    this.log('filled');
  }

  /**
   * a shortcut for .fill(data, useTitleAsValue = true)
   */
  async fillByTitles(formData: Dictionary<any>) {
    return await this.fill(formData, true);
  }

  /**
   * returns all input values from the form
   */
  async read(returnTitlesInsteadValues = false): Promise<Dictionary<any>> {
    await this.waitForLoading();
    const inputs = await this.getInputs();
    const formData = {};

    for (const input of inputs) {
      let value;
      this.log(`get the value for the ${input.type} field: ${input.name}`);

      switch (input.type) {
        case 'text':
        case 'textArea':
          value = await this.getTextValue(input.selector);
          break;
        case 'number':
          value = await this.getNumberValue(input.selector);
          break;
        case 'bool':
          value = await this.getBoolValue(input.selector);
          break;
        case 'toggle':
          value = await this.getToggleValue(input.selector);
          break;
        case 'list':
        case 'fontFamily':
          // eslint-disable-next-line no-case-declarations
          const selector =
            input.type === 'list' ? input.selector : `${input.selector} [data-type="list"]`;
          value = returnTitlesInsteadValues
            ? await this.getListSelectedTitle(selector)
            : await this.getListValue(selector);
          break;
        case 'color':
          value = await this.getColorValue(input.selector);
          break;
        case 'slider':
        case 'fontSize':
        case 'fontWeight':
          value = await this.getSliderValue(input.selector);
          break;
        default:
          throw new Error(`No getter found for input type = ${input.type}`);
      }

      this.log(`got: ${value}`);
      const key = returnTitlesInsteadValues ? input.title : input.name;
      formData[key] = value;
    }

    return formData;
  }

  async includes(expectedData: Dictionary<any>, useTitleInsteadName = false): Promise<boolean> {
    const formData = await this.read(useTitleInsteadName);
    this.log('check form includes expected data:');
    this.log(formData);
    this.log(expectedData);
    return isMatch(formData, expectedData);
  }

  async includesByTitles(expectedData: Dictionary<any>) {
    return this.includes(expectedData, true);
  }

  async setTextValue(selector: string, value: string) {
    const inputSelector = `${selector} input, ${selector} textarea`;
    await this.client.clearElement(inputSelector);
    await this.client.setValue(inputSelector, value);
  }

  async getTextValue(selector: string): Promise<string> {
    return await this.client.getValue(`${selector} input`);
  }

  async getNumberValue(selector: string): Promise<number> {
    return Number(await this.getTextValue(selector));
  }

  async setListValue(
    selector: string,
    valueSetter: string | FNValueSetter,
    useTitleAsValue = false,
  ) {
    if (typeof valueSetter === 'function') {
      const inputName = await this.getAttribute(selector, 'data-name');
      const input = inputName && (await this.getInput(inputName));
      await (valueSetter as FNValueSetter)(this, input);
      // the vue-multiselect's popup-div needs time to be closed
      // otherwise it can overlap the elements under it
      await sleep(100);
      return;
    }

    const value = valueSetter as string;
    const hasInternalSearch: boolean = JSON.parse(
      await this.getAttribute(selector, 'data-internal-search'),
    );

    const optionSelector = useTitleAsValue
      ? `${selector} .multiselect__element [data-option-title="${value}"]`
      : `${selector} .multiselect__element [data-option-value="${value}"]`;

    if (hasInternalSearch) {
      // the list input has a static list of options
      await this.client.click(`${selector} .multiselect`);
      await this.client.click(optionSelector);
    } else {
      // the list input has a dynamic list of options

      // type searching text
      await this.setTextValue(selector, value);
      // wait the options list load
      await this.client.waitForExist(`${selector} .multiselect__element`);
      await this.client.click(optionSelector);
    }

    // the vue-multiselect's popup-div needs time to be closed
    // otherwise it can overlap the elements under it
    await sleep(100);
  }

  async setColorValue(selector: string, value: string) {
    await this.client.click(`${selector} [name="colorpicker-input"]`); // open colorpicker
    // tslint:disable-next-line:no-parameter-reassignment TODO
    value = value.substr(1); // get rid of # character in value
    const inputSelector = `${selector} .vc-input__input`;
    await sleep(100); // give colorpicker some time to be opened
    await this.setInputValue(inputSelector, value);
    await this.client.click(`${selector} [name="colorpicker-input"]`); // close colorpicker
    await sleep(100); // give colorpicker some time to be closed
  }

  async getColorValue(selector: string) {
    return await this.client.getValue(`${selector} [name="colorpicker-input"]`);
  }

  async getListValue(selector: string): Promise<string> {
    return (await this.getListSelectedOption(selector)).value;
  }

  async getListSelectedTitle(selector: string): Promise<string> {
    return (await this.getListSelectedOption(selector)).title;
  }

  async getListSelectedOption(selector: string): Promise<TListOption> {
    return {
      value: await this.getAttribute(selector, 'data-value'),
      title: await this.getAttribute(selector, 'data-option-title'),
    };
  }

  /**
   * return ListInput options
   */
  async getListOptions(fieldName: string): Promise<TListOption[]> {
    await this.waitForLoading(fieldName);
    const input = await this.getInput(fieldName);
    const optionsEls = await this.client.$$(`${input.selector} [data-option-value]`);
    const values: { value: string; title: string }[] = [];
    for (const el of optionsEls) {
      const id = (el as any).ELEMENT;
      const value = (await this.client.elementIdAttribute(id, 'data-option-value')).value;
      const title = (await this.client.elementIdAttribute(id, 'data-option-title')).value;
      values.push({ value, title });
    }
    return values;
  }

  async getOptionByTitle(fieldName: string, optionTitle: string | RegExp) {
    const options = await this.getListOptions(fieldName);
    const option = options.find(option => {
      return typeof optionTitle === 'string'
        ? option.title === optionTitle
        : !!option.title.match(optionTitle);
    });
    return option.value;
  }

  async setBoolValue(selector: string, value: boolean) {
    const checkboxSelector = `${selector} input`;

    // click to change the checkbox state
    await this.client.click(checkboxSelector);

    // if the current value is not what we need than click one more time
    if (value !== (await this.getBoolValue(selector))) {
      await this.client.click(checkboxSelector);
    }
  }

  async getBoolValue(selector: string): Promise<boolean> {
    const checkboxSelector = `${selector} input`;
    return await this.client.isSelected(checkboxSelector);
  }

  async setToggleValue(selector: string, value: boolean) {
    // if the current value is not what we need than click one more time
    const selected = (await this.getAttribute(selector, 'data-value')) === 'true';

    if ((selected && !value) || (!selected && value)) {
      await this.client.click(selector);
    }
  }

  async getToggleValue(selector: string): Promise<boolean> {
    const val = await this.getAttribute(selector, 'data-value');
    return val === 'true';
  }

  async setSliderValue(sliderInputSelector: string, goalValue: number) {
    await sleep(500); // slider has an initialization delay

    const dotSelector = `${sliderInputSelector} .vue-slider-dot-handle`;

    let moveOffset = await this.client.getElementSize(
      `${sliderInputSelector} .vue-slider`,
      'width',
    );

    // reset slider to 0 position
    await this.client.moveToObject(dotSelector);
    await this.client.buttonDown(0);
    await this.client.moveToObject(`${sliderInputSelector} .vue-slider`, 0, 0);
    await sleep(100); // wait for transitions
    await this.client.buttonUp(0);
    await this.client.moveToObject(dotSelector);
    await this.client.buttonDown();

    // use a bisection method to find the correct slider position
    while (true) {
      const currentValue = await this.getSliderValue(sliderInputSelector);

      if (currentValue === goalValue) {
        // we've found it
        await this.client.buttonUp(0);
        return;
      }

      if (goalValue < currentValue) {
        await this.client.moveTo(null, -Math.round(moveOffset), 0);
      } else {
        await this.client.moveTo(null, Math.round(moveOffset), 0);
      }

      // wait for transitions
      await sleep(100);

      moveOffset = moveOffset / 2;
      if (moveOffset < 0.3) throw new Error('Slider position setup failed');
    }
  }

  async getSliderValue(sliderInputSelector: string): Promise<number> {
    // fetch the value from the slider's tooltip
    return Number(
      await this.client.getText(
        `${sliderInputSelector} .vue-slider-tooltip-bottom .vue-slider-tooltip`,
      ),
    );
  }

  async setDateValue(selector: string, date: Date | number) {
    date = new Date(date);
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    // open calendar
    await click(this.t, selector);

    // switch to month selection
    await click(this.t, `${selector} .day__month_btn`);

    // switch to year selection
    await click(this.t, `${selector} .month__year_btn`);

    // select year
    let els: any[];
    els = await this.client.$(selector).$$(`span.year=${year}`);
    this.client.elementIdClick(els[1].ELEMENT);

    // select month
    await this.client
      .$(selector)
      .$(`span.month=${months[month]}`)
      .click();

    // select day
    await this.client
      .$(selector)
      .$(`span.day=${day}`)
      .click();
  }

  async setInputValue(selector: string, value: string) {
    await this.client.waitForVisible(selector);
    await this.client.click(selector);
    await ((this.client.keys(['Control', 'a']) as any) as Promise<any>); // select all
    await ((this.client.keys('Control') as any) as Promise<any>); // release ctrl key
    await ((this.client.keys('Backspace') as any) as Promise<any>); // clear
    await this.client.click(selector); // click again if it's a list input
    await ((this.client.keys(value) as any) as Promise<any>); // type text
  }

  async setTwitchTagsValue(selector: string, values: string[]) {
    // clear tags
    const closeSelector = `${selector} .sp-icon-close`;
    while (await this.client.isExisting(closeSelector)) {
      await this.client.click(closeSelector);
    }

    // click to open the popup
    await this.client.click(selector);

    // select values
    const inputSelector = '.v-dropdown-container .sp-search-input';
    for (const value of values) {
      await this.setInputValue(inputSelector, value);
      await ((this.client.keys('ArrowDown') as any) as Promise<any>);
      await ((this.client.keys('Enter') as any) as Promise<any>);
    }

    // click away and wait for the control to dismiss
    await this.client.click('.tags-container .input-label');
    await this.client.waitForExist('.sp-input-container.sp-open', 500, true);
  }

  /**
   * wait for input to be loaded
   * if no field name provided then wait for all inputs
   */
  async waitForLoading(fieldName?: string) {
    const loadingInputs = (await this.getInputs()).filter(input => {
      return input.loading && (!fieldName || fieldName === input.name);
    });
    const watchers = loadingInputs.map(input => {
      return this.client.waitUntil(async () => (await this.getInput(input.name)).loading === false);
    });
    return Promise.all(watchers);
  }

  public async getAttribute(selectorOrElement: string | any, attrName: string) {
    let element;
    if (typeof selectorOrElement === 'string') {
      element = await this.client.$(selectorOrElement);
    } else {
      element = selectorOrElement;
    }
    const id = element.value.ELEMENT;
    return (await this.client.elementIdAttribute(id, attrName)).value;
  }

  /**
   * returns selector for the input element by a title
   */
  async getInputSelectorByTitle(inputTitle: string): Promise<string> {
    const name = await this.getInputNameByTitle(inputTitle);
    return `[data-role="input"][data-name="${name}"]`;
  }

  /**
   * returns name for the input element by a title
   */
  async getInputNameByTitle(inputTitle: string): Promise<string> {
    const el = await this.client
      .$(`label=${inputTitle}`)
      .$('../..')
      .$('[data-role="input"]');
    return await this.getAttribute(el, 'data-name');
  }

  private log(...args: any[]) {
    if (!this.showLogs) return;
    console.log(...args);
  }
}

/**
 * select ListInput option by given title
 * able to work with a dynamic options list
 */
export function selectTitle(optionTitle: string): FNValueSetter {
  return async (form: FormMonkey, input: IUIInput) => {
    // we should start typing to load list options
    const title = optionTitle as string;
    await form.setInputValue(input.selector, title);

    // wait the options list loading
    await form.client.waitForExist(`${input.selector} .multiselect__element`);
    await form.waitForLoading(input.name);

    // click on the first option
    await click(form.t, `${input.selector} .multiselect__element`);
  };
}

/**
 * select games
 */
export function selectGamesByTitles(
  games: {
    title: string;
    platform: 'facebook' | 'twitch';
  }[],
): FNValueSetter {
  return async (form: FormMonkey, input: IUIInput) => {
    await form.setInputValue(input.selector, games[0].title);
    // wait the options list loading
    await form.client.waitForExist(`${input.selector} .multiselect__element`);
    for (const game of games) {
      // click to the option
      await click(
        form.t,
        `${input.selector} .multiselect__element [data-option-value="${game.platform} ${game.title}"]`,
      );
    }
  };
}

/**
 * a shortcut for FormMonkey.fill()
 */
export async function fillForm(
  t: TExecutionContext,
  selector = DEFAULT_SELECTOR,
  formData: Dictionary<any>,
): Promise<any> {
  return new FormMonkey(t, selector).fill(formData);
}

/**
 * a shortcut for FormMonkey.includes()
 */
export async function formIncludes(
  t: TExecutionContext,
  formData: Dictionary<string>,
): Promise<boolean> {
  return new FormMonkey(t).includes(formData);
}
