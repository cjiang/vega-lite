import {isScaleChannel} from '../../channel';
import {field as fieldRef, FieldDef} from '../../fielddef';
import {hasContinuousDomain, ScaleType} from '../../scale';
import {Dict, extend, keys} from '../../util';
import {VgTransform} from '../../vega.schema';
import {ModelWithField} from '../model';
import {DataFlowNode} from './dataflow';

export class FilterInvalidNode extends DataFlowNode {
  private fieldDefs: Dict<FieldDef<string>>;

  public clone() {
    return new FilterInvalidNode(extend({}, this.fieldDefs));
  }

  constructor(fieldDefs: Dict<FieldDef<string>>) {
   super();

   this.fieldDefs = fieldDefs;
  }

  public static make(model: ModelWithField): FilterInvalidNode {

    const filter = model.reduceFieldDef((aggregator: Dict<FieldDef<string>>, fieldDef, channel) => {
      const scaleComponent = isScaleChannel(channel) && model.getScaleComponent(channel);
      if (scaleComponent) {
        const scaleType = scaleComponent.get('type');

        // only automatically filter null for continuous domain since discrete domain scales can handle invalid values.
        if (hasContinuousDomain(scaleType) && !fieldDef.aggregate) {
          aggregator[fieldDef.field] = fieldDef;
        }
      }
      return aggregator;
    }, {} as Dict<FieldDef<string>>);

    if (!keys(filter).length) {
      return null;
    }

  return new FilterInvalidNode(filter);
  }

  get filter() {
    return this.fieldDefs;
  }

  // create the VgTransforms for each of the filtered fields
  public assemble(): VgTransform[] {

     return keys(this.filter).reduce((vegaFilters, field) => {
      const fieldDef = this.fieldDefs[field];
      const filters = [];
      const ref = fieldRef(fieldDef, {expr: 'datum'});

      if (fieldDef !== null) {
        filters.push(`${ref} !== null`);
        filters.push(`!isNaN(${ref})`);
      }

      vegaFilters.push(filters.length > 0 ? {
        type: 'filter',
        expr: filters.join(' && ')
      } : null);
      return vegaFilters;
    }, []);
  }
}
